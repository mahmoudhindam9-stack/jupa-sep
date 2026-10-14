// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { convertToInventoryUnit } from "@/shared/utils/inventoryUtils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Pencil,
  Trash2,
  Plus,
  Loader2,
  Search,
  Eye,
  EyeOff,
  Coins,
  Percent,
  ChefHat,
  Sparkles,
  Info,
  Upload,
  Image as ImageIcon,
  Building2,
  ShieldCheck,
  Clock,
  Thermometer,
  AlertTriangle,
} from "lucide-react";
import { useSettings } from "@/hooks/use-settings";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { menuService } from "@/features/menu/services/menuService";
import { inventoryService } from "@/features/inventory/services/inventoryService";
import { erpStore, MenuItemQualitySpecs } from "@/shared/services/erpStore";
import { BackToRestaurantButton } from "@/components/admin/BackToRestaurantButton";

export const Route = createFileRoute("/admin/menu")({
  head: () => ({ meta: [{ title: "إدارة المنيو" }] }),
  component: MenuPage,
});

type Category = { id: string; name_ar: string; sort_order: number };
type MenuItemIngredient = {
  inventory_id: string;
  weight: number;
  unit?: string;
  optional?: boolean;
  waste_percent?: number;
  notes?: string;
};
type MenuItem = {
  id: string;
  name_ar: string;
  price: number;
  category_id: string;
  image_url: string | null;
  is_available: boolean;
  requires_oven?: boolean;
  ingredients?: MenuItemIngredient[];
  inventory_tracking?: string;
};

function MenuPage() {
  const { formatPrice } = useSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [itemToDelete, setItemToDelete] = useState<MenuItem | null>(null);

  const [catForm, setCatForm] = useState({ name_ar: "", sort_order: "0" });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const [itemForm, setItemForm] = useState<Partial<MenuItem>>({
    name_ar: "",
    price: 0,
    category_id: "",
    image_url: "",
    is_available: true,
    requires_oven: false,
    ingredients: [],
    inventory_tracking: "not_tracked",
    badge: "",
    additions: [],
  });
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const [qualityForm, setQualityForm] = useState<Partial<MenuItemQualitySpecs>>({
    shelf_life_hours: 24,
    storage_condition_label: "4°م ثلاجة مبردة",
    allergens: [],
    quality_checklist: ["فحص الطزاجة والرائحة", "التأكد من التغليف المانع للتلوث"],
  });

  const [selectedInventoryId, setSelectedInventoryId] = useState<string>("");
  const [selectedRecipeWarehouseId, setSelectedRecipeWarehouseId] = useState<string>("all");
  const [ingredientWeight, setIngredientWeight] = useState<string>("");
  const [ingredientUnit, setIngredientUnit] = useState<string>("");
  const [ingredientOptional, setIngredientOptional] = useState<boolean>(false);
  const [ingredientWastePercent, setIngredientWastePercent] = useState<string>("");
  const [ingredientNotes, setIngredientNotes] = useState<string>("");

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setItemForm((s) => ({ ...s, image_url: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const categoriesQuery = useQuery({
    queryKey: ["admin", "menu_categories"],
    queryFn: () => menuService.getCategories(),
  });

  const inventoryQuery = useQuery({
    queryKey: ["admin", "inventory"],
    queryFn: () => inventoryService.getInventory(),
    refetchInterval: 5000,
  });

  const warehousesQuery = useQuery({
    queryKey: ["admin", "warehouses"],
    queryFn: () => inventoryService.getWarehouses(),
  });

  const warehouseInventoryQuery = useQuery({
    queryKey: ["admin", "warehouse_inventory"],
    queryFn: () => inventoryService.getWarehouseInventory(),
    refetchInterval: 5000,
  });

  const itemsQuery = useQuery({
    queryKey: ["admin", "menu_items"],
    queryFn: () => menuService.getMenuItems(),
  });

  const filteredItems = useMemo(() => {
    const items = itemsQuery.data ?? [];
    return items.filter((i) => {
      const matchCat = activeCategory === "all" || i.category_id === activeCategory;
      const matchSearch = !search.trim() || i.name_ar.includes(search.trim());
      return matchCat && matchSearch;
    });
  }, [itemsQuery.data, activeCategory, search]);

  const upsertCategory = useMutation({
    mutationFn: async () => {
      const payload = { name_ar: catForm.name_ar, sort_order: Number(catForm.sort_order) };
      return await menuService.upsertCategory(payload, editingCategory?.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "menu_categories"] });
      setCatForm({ name_ar: "", sort_order: "0" });
      setEditingCategory(null);
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      await menuService.deleteCategory(id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "menu_categories"] }),
  });

  const upsertItem = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name_ar: itemForm.name_ar || "",
        price: Number(itemForm.price),
        category_id: itemForm.category_id || null,
        image_url: itemForm.image_url || null,
        is_available: itemForm.is_available ?? true,
        ingredients: itemForm.ingredients || [],
        inventory_tracking: itemForm.inventory_tracking || "not_tracked",
        badge: itemForm.badge || null,
        additions: itemForm.additions || [],
      };

      const result = await menuService.upsertMenuItem(payload, editingItem?.id);
      if (result && result.id) {
        erpStore.saveMenuItemQualitySpecs(result.id, {
          menu_item_id: result.id,
          shelf_life_hours: Number(qualityForm.shelf_life_hours || 24),
          storage_condition_label: qualityForm.storage_condition_label || "4°م ثلاجة",
          allergens: qualityForm.allergens || [],
          quality_checklist: qualityForm.quality_checklist || ["فحص الجودة والسلامة والطزاجة"],
        });
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "menu_items"] });
      setIsItemModalOpen(false);
      setShowSaveConfirm(false);
      setShowCancelConfirm(false);
      setEditingItem(null);
      setItemForm({
        name_ar: "",
        price: 0,
        category_id: "",
        image_url: "",
        is_available: true,
        ingredients: [],
        inventory_tracking: "not_tracked",
      });
      setQualityForm({
        shelf_life_hours: 24,
        storage_condition_label: "4°م ثلاجة مبردة",
        allergens: [],
        quality_checklist: ["فحص الطزاجة والرائحة", "التأكد من التغليف المانع للتلوث"],
      });
      setSelectedInventoryId("");
      setIngredientWeight("");
      toast({
        title: "✅ تم الحفظ بنجاح",
        description: editingItem
          ? "تم تحديث بيانات الصنف بنجاح!"
          : "تمت إضافة الصنف إلى المنيو بنجاح!",
      });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await menuService.deleteMenuItem(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "menu_items"] });
      queryClient.invalidateQueries({ queryKey: ["menu_items"] });
      toast({
        title: "🗑️ تم حذف المنتج بنجاح",
        description: "تمت إزالة الصنف من القائمة والمخزون بنجاح.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "❌ خطأ في حذف المنتج",
        description: err?.message || "حدث خطأ أثناء محاولة الحذف",
        variant: "destructive",
      });
    },
  });

  // Toggle availability of item directly from the card
  const toggleItemAvailability = useMutation({
    mutationFn: async ({ id, isAvailable }: { id: string; isAvailable: boolean }) => {
      await menuService.toggleMenuItemAvailability(id, isAvailable);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "menu_items"] });
    },
  });

  const openAddModal = () => {
    setEditingItem(null);
    setItemForm({
      name_ar: "",
      price: 0,
      category_id: activeCategory !== "all" ? activeCategory : "",
      image_url: "",
      is_available: true,
      requires_oven: false,
      ingredients: [],
      inventory_tracking: "not_tracked",
      badge: "",
      additions: [],
    });
    setQualityForm({
      shelf_life_hours: 24,
      storage_condition_label: "4°م ثلاجة مبردة",
      allergens: [],
      quality_checklist: ["فحص الطزاجة والرائحة", "التأكد من التغليف المانع للتلوث"],
    });
    setSelectedInventoryId("");
    setIngredientWeight("");
    setIsItemModalOpen(true);
  };

  const startEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemForm({
      ...item,
      requires_oven: !!item.requires_oven,
      ingredients: Array.isArray(item.ingredients) ? item.ingredients : [],
      inventory_tracking: item.inventory_tracking || "not_tracked",
      additions: Array.isArray(item.additions) ? item.additions : [],
    });
    const specs = erpStore.getMenuItemQualitySpecs(item.id);
    if (specs) {
      setQualityForm(specs);
    } else {
      setQualityForm({
        shelf_life_hours: 24,
        storage_condition_label: "4°م ثلاجة مبردة",
        allergens: [],
        quality_checklist: ["فحص الطزاجة والرائحة", "التأكد من التغليف المانع للتلوث"],
      });
    }
    setIsItemModalOpen(true);
  };

  const cancelEditItem = () => {
    setEditingItem(null);
    setItemForm({
      name_ar: "",
      price: 0,
      category_id: "",
      image_url: "",
      is_available: true,
      requires_oven: false,
      ingredients: [],
      inventory_tracking: "not_tracked",
      badge: "",
      additions: [],
    });
    setQualityForm({
      shelf_life_hours: 24,
      storage_condition_label: "4°م ثلاجة مبردة",
      allergens: [],
      quality_checklist: ["فحص الطزاجة والرائحة", "التأكد من التغليف المانع للتلوث"],
    });
    setSelectedInventoryId("");
    setIngredientWeight("");
  };

  const getInventoryStock = (inventoryId: string) => {
    const inventoryItem: any = (inventoryQuery.data ?? []).find(
      (item: any) => item.id === inventoryId,
    );
    if (!inventoryItem) return null;

    if (selectedRecipeWarehouseId === "all") {
      return Number(inventoryItem.quantity || 0);
    }

    const warehouseItem: any = (warehouseInventoryQuery.data ?? []).find(
      (item: any) =>
        item.warehouse_id === selectedRecipeWarehouseId && item.inventory_id === inventoryId,
    );
    return Number(warehouseItem?.quantity || 0);
  };

  const startEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCatForm({
      name_ar: cat.name_ar,
      sort_order: String(cat.sort_order),
    });
  };

  // Recipe Cost and Profit Margin analysis calculations
  const recipeStats = useMemo(() => {
    const ingredients = itemForm.ingredients || [];
    let cost = 0;
    ingredients.forEach((ing) => {
      const invItem: any = inventoryQuery.data?.find((i: any) => i.id === ing.inventory_id);
      if (invItem) {
        const convertedWeight = convertToInventoryUnit(Number(ing.weight), ing.unit, invItem.unit);
        const wasteFactor = ing.waste_percent ? 1 + Number(ing.waste_percent) / 100 : 1;
        cost += Number(invItem.cost) * convertedWeight * wasteFactor;
      }
    });

    const price = Number(itemForm.price || 0);
    const profit = price - cost;
    const margin = price > 0 ? (profit / price) * 100 : 0;

    return { cost, profit, margin };
  }, [itemForm.ingredients, itemForm.price, inventoryQuery.data]);

  return (
    <div className="space-y-6 text-right">
      {/* Top Bar - Frozen Sticky Header with Clear Department Title */}
      <div className="sticky top-0 z-20 bg-card/95 backdrop-blur py-3 px-3 sm:px-5 -mx-2 sm:-mx-4 border-b border-border/80 flex items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3 flex-wrap">
          <BackToRestaurantButton />
          <div className="h-5 w-px bg-border/80 hidden sm:block" />
          <div className="flex items-center gap-2">
            <Utensils size={18} className="text-primary shrink-0" />
            <h1 className="text-sm sm:text-base font-black text-foreground tracking-tight whitespace-nowrap">
              إدارة المنيو وقائمة الطعام والتكلفة
            </h1>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground">إدارة المنيو والتكلفة</h1>
          <p className="text-sm text-muted-foreground mt-1">
            تحديد فئات الطعام، تسعير الأصناف، وتحليل التكاليف وهامش الربح للمكونات
          </p>
        </div>
      </div>

      <Tabs defaultValue="items" className="w-full">
        <TabsList className="bg-muted p-1 rounded-xl">
          <TabsTrigger value="items" className="rounded-lg font-bold">
            إدارة الأصناف والوصفات
          </TabsTrigger>
          <TabsTrigger value="categories" className="rounded-lg font-bold">
            الفئات والترتيب
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="space-y-4 mt-4">
          {/* Add / Edit Category form */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-card border border-border p-5 rounded-2xl">
            <div>
              <Label className="text-xs font-bold">اسم الفئة</Label>
              <Input
                className="mt-1.5"
                value={catForm.name_ar}
                onChange={(e) => setCatForm((s) => ({ ...s, name_ar: e.target.value }))}
                placeholder="مثال: مشروبات ساخنة، بيتزا"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">ترتيب العرض</Label>
              <Input
                className="mt-1.5"
                type="number"
                value={catForm.sort_order}
                onChange={(e) => setCatForm((s) => ({ ...s, sort_order: e.target.value }))}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={() => upsertCategory.mutate()}
                disabled={!catForm.name_ar || upsertCategory.isPending}
                className="font-bold flex-1"
              >
                <Plus size={16} className="ml-1" />
                {editingCategory ? "حفظ التعديل" : "إضافة فئة"}
              </Button>
              {editingCategory && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingCategory(null);
                    setCatForm({ name_ar: "", sort_order: "0" });
                  }}
                  className="font-bold"
                >
                  إلغاء
                </Button>
              )}
            </div>
          </div>

          {/* Categories List */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-base text-foreground">فئات المنيو الحالية</h3>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-right p-3.5 font-bold">اسم الفئة</th>
                    <th className="text-right p-3.5 font-bold">الترتيب</th>
                    <th className="text-center p-3.5 font-bold w-[130px]">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categoriesQuery.isLoading ? (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-muted-foreground">
                        جاري تحميل الفئات...
                      </td>
                    </tr>
                  ) : (categoriesQuery.data ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center py-8 text-muted-foreground">
                        لم يتم إضافة فئات للمنيو بعد.
                      </td>
                    </tr>
                  ) : (
                    (categoriesQuery.data ?? []).map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="p-3.5 font-bold">{c.name_ar}</td>
                        <td className="p-3.5 text-muted-foreground font-mono">{c.sort_order}</td>
                        <td className="p-3.5 text-center flex justify-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 rounded-lg"
                            onClick={() => startEditCategory(c)}
                          >
                            <Pencil size={12} />
                          </Button>
                          <Button
                            size="icon"
                            variant="destructive"
                            className="h-8 w-8 rounded-lg"
                            onClick={() => {
                              if (
                                confirm(
                                  `هل تريد بالتأكيد حذف فئة ${c.name_ar}؟ سيؤثر هذا على الأصناف التابعة لها.`,
                                )
                              ) {
                                deleteCategory.mutate(c.id);
                              }
                            }}
                            disabled={deleteCategory.isPending}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="items" className="space-y-5 mt-4">
          {/* Catalog grid catalog items table view */}
          <div className="bg-card border border-border p-5 rounded-2xl space-y-4">
            <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={16}
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="ابحث عن صنف بالمنيو..."
                  className="pr-9 text-right"
                />
              </div>

              <Button
                onClick={openAddModal}
                className="font-bold bg-primary hover:bg-primary/90 text-primary-foreground flex items-center gap-2 h-10 px-5 rounded-xl shadow-xs cursor-pointer"
              >
                <Plus size={18} />
                <span>إضافة صنف جديد للمنيو</span>
              </Button>
            </div>

            {/* Categories filters */}
            <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
              <CategoryPill
                label="الكل"
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

            {itemsQuery.isLoading ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <Loader2 className="animate-spin ml-2" />
                <span>جاري تحميل المنيو...</span>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center text-muted-foreground py-20">
                لا توجد أصناف مطابقة للبحث أو للفلترة حالياً
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredItems.map((item) => {
                  const cat = categoriesQuery.data?.find((c) => c.id === item.category_id);

                  return (
                    <div
                      key={item.id}
                      className="group relative bg-card rounded-2xl overflow-hidden border border-border text-right transition-all hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between"
                    >
                      {/* Unavailable layer */}
                      {!item.is_available && (
                        <div className="absolute inset-0 bg-black/45 z-10 flex flex-col items-center justify-center text-white font-bold text-sm rounded-2xl">
                          <EyeOff size={20} className="mb-1" />
                          <span>غير متاح مؤقتاً</span>
                        </div>
                      )}

                      <div>
                        {/* Food image */}
                        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name_ar}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground bg-muted/40">
                              <ImageIcon size={24} className="opacity-30" />
                            </div>
                          )}

                          {/* Price badge */}
                          <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs font-black px-2.5 py-1 rounded-lg shadow-sm">
                            {formatPrice(item.price)}
                          </div>

                          {/* Custom Promotional Badge */}
                          {item.badge && (
                            <div className="absolute top-0 right-0 bg-slate-900/90 backdrop-blur-md text-white text-xs font-black px-3.5 py-1.5 rounded-bl-2xl shadow-md z-10">
                              {item.badge}
                            </div>
                          )}

                          {/* Card header controls */}
                          <div className="absolute top-2 right-2 flex gap-1.5 z-20">
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-7 w-7 bg-background/90 hover:bg-background rounded-md shadow-xs"
                              onClick={() => startEditItem(item)}
                            >
                              <Pencil size={11} />
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-7 w-7 rounded-md shadow-xs cursor-pointer"
                              onClick={() => setItemToDelete(item)}
                              disabled={deleteItem.isPending}
                            >
                              <Trash2 size={11} />
                            </Button>
                          </div>
                        </div>

                        <div className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-bold text-sm text-card-foreground line-clamp-2">
                                {item.name_ar}
                              </h4>
                              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {cat?.name_ar ?? "غير محدد"}
                                </span>
                                <span className="text-[10px] font-bold text-slate-300">•</span>
                                {item.inventory_tracking === "recipe_required" ? (
                                  !(item.ingredients && item.ingredients.length > 0) ? (
                                    <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200/50 animate-pulse">
                                      وصفة مفقودة!
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50">
                                      تتبع مخزون
                                    </span>
                                  )
                                ) : (
                                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/50">
                                    غير متتبع
                                  </span>
                                )}
                                {item.requires_oven && (
                                  <span className="text-[10px] font-extrabold text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded border border-orange-300 shadow-2xs">
                                    فرن 🍕
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Recipe items tags if exists */}
                          {item.ingredients && item.ingredients.length > 0 && (
                            <div className="pt-2 border-t border-border/40 space-y-1">
                              <span className="text-[10px] font-bold text-muted-foreground block">
                                المكونات المسحوبة:
                              </span>
                              <div className="flex flex-wrap gap-1 justify-start">
                                {item.ingredients.map((ing) => {
                                  const invItem = inventoryQuery.data?.find(
                                    (i: any) => i.id === ing.inventory_id,
                                  );
                                  return (
                                    <span
                                      key={ing.inventory_id}
                                      className="text-[9px] bg-muted/80 text-muted-foreground px-1.5 py-0.5 rounded border border-border/20 font-medium"
                                    >
                                      {invItem?.name_ar || "مادة"}: {ing.weight}{" "}
                                      {invItem?.unit || ""}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Quality Specs Tag */}
                          {(() => {
                            const specs = erpStore.getMenuItemQualitySpecs(item.id);
                            return (
                              <div className="pt-2 border-t border-border/40 flex flex-wrap items-center gap-1.5 text-[9px]">
                                <span className="bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <Clock size={10} />
                                  {specs?.shelf_life_hours || 24} س صلاحية
                                </span>
                                {specs?.storage_condition_label && (
                                  <span className="bg-sky-500/10 text-sky-700 dark:text-sky-400 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <Thermometer size={10} />
                                    {specs.storage_condition_label}
                                  </span>
                                )}
                                {specs?.allergens && specs.allergens.length > 0 && (
                                  <span className="bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <AlertTriangle size={10} />
                                    حساسية: {specs.allergens.join("، ")}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      {/* Card bottom bar with quick toggle availability */}
                      <div className="px-4 py-2 bg-muted/20 border-t border-border/40 flex items-center justify-between z-20">
                        <span className="text-[10px] font-bold text-muted-foreground">
                          توفير الصنف للبيع:
                        </span>
                        <div className="flex items-center gap-1.5 scale-85 origin-left">
                          <Switch
                            checked={item.is_available}
                            onCheckedChange={(val) =>
                              toggleItemAvailability.mutate({ id: item.id, isAvailable: val })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-destructive flex items-center gap-2">
              <Trash2 size={18} />
              تأكيد حذف المنتج نهائياً
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              هل أنت متأكد من حذف صنف{" "}
              <span className="font-bold text-foreground">"{itemToDelete?.name_ar}"</span> من المنيو
              والمخزون؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-2">
            <AlertDialogCancel className="font-bold cursor-pointer">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold cursor-pointer"
              onClick={() => {
                if (itemToDelete) {
                  deleteItem.mutate(itemToDelete.id);
                  setItemToDelete(null);
                }
              }}
            >
              نعم، حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add / Edit Menu Item Dialog Modal */}
      <Dialog
        open={isItemModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setShowCancelConfirm(true);
          } else {
            setIsItemModalOpen(true);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="text-right border-b border-border/40 pb-3">
            <DialogTitle className="font-black text-xl text-primary flex items-center gap-2">
              <ChefHat size={22} />
              {editingItem
                ? `تعديل الصنف: ${editingItem.name_ar}`
                : "إضافة صنف مأكولات أو مشروب جديد"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              قم بإدخال بيانات الصنف والسعر والمكونات واشتراطات الجودة ثم انقر حفظ
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left column: main inputs */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-bold">اسم الصنف بالكامل *</Label>
                    <Input
                      className="mt-1.5 font-bold"
                      value={itemForm.name_ar || ""}
                      onChange={(e) => setItemForm((s) => ({ ...s, name_ar: e.target.value }))}
                      placeholder="مثال: بيتزا بيبروني سوبريم"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold">سعر البيع المقترح للمستهلك (ج.م) *</Label>
                    <Input
                      className="mt-1.5 font-bold"
                      type="number"
                      value={itemForm.price || ""}
                      onChange={(e) =>
                        setItemForm((s) => ({ ...s, price: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold">فئة المنيو *</Label>
                    <select
                      className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-right font-bold"
                      value={itemForm.category_id || ""}
                      onChange={(e) => setItemForm((s) => ({ ...s, category_id: e.target.value }))}
                    >
                      <option value="">اختر الفئة المناسبة</option>
                      {(categoriesQuery.data ?? []).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name_ar}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-bold">شعار أو لافتة المنتج (اختياري)</Label>
                    <Input
                      className="mt-1.5 h-9 text-xs"
                      type="text"
                      value={itemForm.badge || ""}
                      onChange={(e) => setItemForm((s) => ({ ...s, badge: e.target.value }))}
                      placeholder="مثال: خصم خاص، الأكثر طلباً، عرض جديد"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {["🔥 الأكثر طلباً", "✨ عرض جديد", "🏷️ خصم خاص", "⭐ مميز", "👑 الشيف"].map(
                        (preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setItemForm((s) => ({ ...s, badge: preset }))}
                            className="text-[10px] bg-muted hover:bg-primary/10 text-foreground px-2 py-0.5 rounded-md border border-border transition font-medium cursor-pointer"
                          >
                            {preset}
                          </button>
                        ),
                      )}
                      {itemForm.badge && (
                        <button
                          type="button"
                          onClick={() => setItemForm((s) => ({ ...s, badge: "" }))}
                          className="text-[10px] bg-destructive/10 text-destructive px-2 py-0.5 rounded-md font-bold cursor-pointer"
                        >
                          إزالة
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-bold">وضع تتبع المخزون</Label>
                    <select
                      className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-right font-bold"
                      value={itemForm.inventory_tracking || "not_tracked"}
                      onChange={(e) =>
                        setItemForm((s) => ({ ...s, inventory_tracking: e.target.value }))
                      }
                    >
                      <option value="not_tracked">
                        لا يتطلب تتبع مخزون (مثل علب البيبسي/العصائر)
                      </option>
                      <option value="recipe_required">
                        يتطلب وجود مكونات ووصفة (خصم تلقائي عند التحضير)
                      </option>
                    </select>
                  </div>

                  {/* File / URL Upload inputs */}
                  <div>
                    <Label className="text-xs font-bold">رابط صورة الصنف (أو ارفع صورة)</Label>
                    <div className="flex gap-2 items-center mt-1.5">
                      <Input
                        value={itemForm.image_url || ""}
                        onChange={(e) => setItemForm((s) => ({ ...s, image_url: e.target.value }))}
                        placeholder="https://example.com/food.jpg"
                        className="flex-1 text-left"
                        dir="ltr"
                      />
                      <label className="cursor-pointer inline-flex items-center justify-center gap-1 rounded-md text-xs font-semibold h-9 px-3 border border-dashed border-primary text-primary hover:bg-primary/5 transition shrink-0 bg-background">
                        <Upload size={12} />
                        <span>رفع</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2 border-t border-border/40">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="available"
                      checked={!!itemForm.is_available}
                      onCheckedChange={(v) => setItemForm((s) => ({ ...s, is_available: v }))}
                    />
                    <Label htmlFor="available" className="text-xs font-bold cursor-pointer">
                      متاح حالياً للطلب الفوري
                    </Label>
                  </div>

                  <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 px-3 py-1.5 rounded-lg">
                    <Switch
                      id="requires_oven"
                      checked={!!itemForm.requires_oven}
                      onCheckedChange={(v) => setItemForm((s) => ({ ...s, requires_oven: v }))}
                    />
                    <Label
                      htmlFor="requires_oven"
                      className="text-xs font-bold cursor-pointer text-orange-800 dark:text-orange-300 flex items-center gap-1"
                    >
                      <span>يتطلب تحضير في الفرن (شاشة الفرن / KDS) 🍕</span>
                    </Label>
                  </div>
                </div>
              </div>

              {/* Right column: Image Form Preview */}
              <div className="flex flex-col justify-center items-center bg-muted/40 rounded-2xl p-4 border border-dashed border-border text-center">
                <span className="text-xs font-bold text-muted-foreground block mb-3">
                  معاينة الصورة
                </span>
                {itemForm.image_url ? (
                  <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-border">
                    <img
                      src={itemForm.image_url}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="absolute bottom-2 right-2 text-[10px] h-6 px-2"
                      onClick={() => setItemForm((s) => ({ ...s, image_url: "" }))}
                    >
                      إزالة الصورة
                    </Button>
                  </div>
                ) : (
                  <div className="w-full aspect-[4/3] flex flex-col items-center justify-center bg-background/50 rounded-xl text-muted-foreground">
                    <ImageIcon size={32} className="opacity-30 mb-1" />
                    <span className="text-[10px]">لا توجد صورة مضافة</span>
                  </div>
                )}
              </div>
            </div>

            {/* Recipe Ingredients builder section */}
            <div className="border-t border-border/40 pt-5 mt-2">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                <div>
                  <Label className="text-sm font-black text-primary block">
                    مكونات الوصفة (تُخصم تلقائياً من كميات المخزن عند البيع)
                  </Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    اربط الصنف بمواده الخام للتحكم الحقيقي الفوري بالهدر والمخزن
                  </p>
                </div>

                {itemForm.price ? (
                  <div className="flex items-center gap-3 text-xs bg-muted/60 px-4 py-2 rounded-xl border border-border">
                    <div>
                      <span className="text-muted-foreground text-[10px] block">
                        تكلفة المكونات:
                      </span>
                      <span className="font-bold text-foreground">
                        {recipeStats.cost.toFixed(2)} ج.م
                      </span>
                    </div>
                    <div className="h-6 w-px bg-border" />
                    <div>
                      <span className="text-muted-foreground text-[10px] block">
                        هامش الربح الفعلي:
                      </span>
                      <span
                        className={`font-black ${recipeStats.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}
                      >
                        {recipeStats.profit.toFixed(2)} ج.م ({recipeStats.margin.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="bg-muted/40 p-4 rounded-2xl border border-dashed border-border mb-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs font-bold text-primary flex items-center gap-1">
                      <Building2 size={13} />
                      المخزن الفرعي المستهدف
                    </Label>
                    <select
                      className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none text-right font-bold"
                      value={selectedRecipeWarehouseId}
                      onChange={(e) => setSelectedRecipeWarehouseId(e.target.value)}
                    >
                      <option value="all">جميع المخازن (رصيد مجمع)</option>
                      {(warehousesQuery.data ?? []).map((wh) => (
                        <option key={wh.id} value={wh.id}>
                          {wh.name} {wh.is_default ? "(رئيسي)" : "(فرعي)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-bold">اختر صنفاً من المخزن لتضمينه</Label>
                    <select
                      className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none text-right font-bold"
                      value={selectedInventoryId}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedInventoryId(val);
                        const inv = inventoryQuery.data?.find((i: any) => i.id === val);
                        if (inv) {
                          setIngredientUnit(inv.unit);
                        }
                      }}
                    >
                      <option value="">اختر المادة الخام...</option>
                      {(inventoryQuery.data ?? []).map((inv: any) => {
                        let stock = Number(inv.quantity || 0);
                        if (selectedRecipeWarehouseId !== "all") {
                          const whRec = (warehouseInventoryQuery.data ?? []).find(
                            (w: any) =>
                              w.warehouse_id === selectedRecipeWarehouseId &&
                              w.inventory_id === inv.id,
                          );
                          stock = Number(whRec?.quantity || 0);
                        }
                        return (
                          <option key={inv.id} value={inv.id}>
                            {inv.name_ar} (متوفر: {stock.toFixed(2)} {inv.unit})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-bold">الوزن / الكمية المطلوبة للوجبة</Label>
                    <Input
                      type="number"
                      step="any"
                      placeholder="مثال: 0.150 للمية وخمسين جرام"
                      value={ingredientWeight}
                      onChange={(e) => setIngredientWeight(e.target.value)}
                      className="h-9 text-xs mt-1.5 font-bold"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-bold">الوحدة بالوصفة</Label>
                    <select
                      className="w-full mt-1.5 h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-none text-right font-bold"
                      value={ingredientUnit}
                      onChange={(e) => setIngredientUnit(e.target.value)}
                    >
                      <option value="">اختر الوحدة</option>
                      <option value="g">جرام (g)</option>
                      <option value="kg">كيلوجرام (kg)</option>
                      <option value="ml">مليلتر (ml)</option>
                      <option value="l">لتر (l)</option>
                      <option value="pcs">قطعة (pcs)</option>
                      <option value="box">علبة (box)</option>
                      <option value="pack">عبوة (pack)</option>
                      <option value="bottle">زجاجة (bottle)</option>
                      <option value="can">كان (can)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-9 bg-background hover:bg-muted text-xs font-bold"
                    onClick={() => {
                      if (!selectedInventoryId || !ingredientWeight) return;
                      const weightNum = Number(ingredientWeight);
                      if (isNaN(weightNum) || weightNum <= 0) return;

                      const wasteNum = Number(ingredientWastePercent) || undefined;

                      const currentIngredients = itemForm.ingredients || [];
                      const existingIdx = currentIngredients.findIndex(
                        (ing) => ing.inventory_id === selectedInventoryId,
                      );

                      const newIngredientItem: MenuItemIngredient = {
                        inventory_id: selectedInventoryId,
                        weight: weightNum,
                        unit: ingredientUnit || undefined,
                        optional: ingredientOptional || undefined,
                        waste_percent: wasteNum,
                        notes: ingredientNotes || undefined,
                      };

                      let updated: MenuItemIngredient[];
                      if (existingIdx > -1) {
                        updated = [...currentIngredients];
                        updated[existingIdx] = newIngredientItem;
                      } else {
                        updated = [...currentIngredients, newIngredientItem];
                      }

                      setItemForm((s) => ({ ...s, ingredients: updated }));
                      setSelectedInventoryId("");
                      setIngredientWeight("");
                      setIngredientUnit("");
                      setIngredientOptional(false);
                      setIngredientWastePercent("");
                      setIngredientNotes("");
                    }}
                  >
                    <Plus size={14} className="ml-1" />
                    إضافة المادة للوصفة
                  </Button>
                </div>
              </div>

              {itemForm.ingredients && itemForm.ingredients.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1.5 border border-border/40 rounded-2xl bg-muted/10">
                  {itemForm.ingredients.map((ing) => {
                    const invItem: any = inventoryQuery.data?.find(
                      (i: any) => i.id === ing.inventory_id,
                    );
                    const convertedWeight = convertToInventoryUnit(
                      Number(ing.weight),
                      ing.unit,
                      invItem?.unit,
                    );
                    const wasteFactor = ing.waste_percent ? 1 + Number(ing.waste_percent) / 100 : 1;
                    const ingredientCost = invItem
                      ? Number(invItem.cost) * convertedWeight * wasteFactor
                      : 0;

                    return (
                      <div
                        key={ing.inventory_id}
                        className="flex flex-col justify-between bg-card border border-border p-3 rounded-xl text-xs space-y-2 relative"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground">
                              {invItem?.name_ar || "مادة محذوفة"}
                            </span>
                            {ing.optional && (
                              <span className="bg-amber-500/10 text-amber-600 text-[9px] px-1.5 py-0.5 rounded font-bold">
                                اختياري
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground block">
                            المقدار: {ing.weight} {ing.unit || invItem?.unit || ""}
                          </span>
                          <span className="text-[10px] text-primary font-bold block">
                            رصيد المخزن: {getInventoryStock(ing.inventory_id)?.toFixed(2) ?? "0.00"}{" "}
                            {invItem?.unit || ""}
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-lg absolute bottom-2 left-2"
                          onClick={() => {
                            setItemForm((s) => ({
                              ...s,
                              ingredients: (s.ingredients || []).filter(
                                (i) => i.inventory_id !== ing.inventory_id,
                              ),
                            }));
                          }}
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground text-center py-4 bg-muted/10 rounded-2xl border border-dashed border-border/60">
                  <Info size={12} />
                  <span>لا توجد مكونات جردية مرتبطة بهذا الصنف بعد.</span>
                </div>
              )}
            </div>

            {/* Quality & Shelf-Life Specifications Section */}
            <div className="border-t border-border/40 pt-5 mt-2 space-y-3">
              <div>
                <Label className="text-sm font-black text-primary flex items-center gap-1.5">
                  <ShieldCheck size={16} />
                  معايير جودة الطعام والسلامة والحد الأقصى للصلاحية بعد التحضير
                </Label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/20 p-4 rounded-2xl border border-border">
                <div>
                  <Label className="text-xs font-bold flex items-center gap-1">
                    <Clock size={13} className="text-amber-500" />
                    مدة الصلاحية بعد التحضير (بالساعات)
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="مثال: 24"
                    value={qualityForm.shelf_life_hours || 24}
                    onChange={(e) =>
                      setQualityForm((s) => ({ ...s, shelf_life_hours: Number(e.target.value) }))
                    }
                    className="h-9 text-xs font-mono font-bold mt-1.5"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold flex items-center gap-1">
                    <Thermometer size={13} className="text-sky-500" />
                    شرط درجات حرارة التخزين / الحفظ
                  </Label>
                  <Input
                    type="text"
                    placeholder="مثال: 4°م ثلاجة / أو 60°م سخان"
                    value={qualityForm.storage_condition_label || ""}
                    onChange={(e) =>
                      setQualityForm((s) => ({ ...s, storage_condition_label: e.target.value }))
                    }
                    className="h-9 text-xs font-bold mt-1.5"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold flex items-center gap-1">
                    <AlertTriangle size={13} className="text-rose-500" />
                    مسببات الحساسية (مفصولة بفواصل)
                  </Label>
                  <Input
                    type="text"
                    placeholder="مثال: غلوتين، جلبان، ألبان، بيض"
                    value={(qualityForm.allergens || []).join("، ")}
                    onChange={(e) =>
                      setQualityForm((s) => ({
                        ...s,
                        allergens: e.target.value
                          .split("،")
                          .flatMap((x) => x.split(","))
                          .map((x) => x.trim())
                          .filter(Boolean),
                      }))
                    }
                    className="h-9 text-xs font-bold mt-1.5"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2 justify-end border-t border-border/40 pt-4 mt-4">
            <Button
              type="button"
              onClick={() => setShowSaveConfirm(true)}
              disabled={!itemForm.name_ar || !itemForm.category_id || upsertItem.isPending}
              className="font-bold px-6 cursor-pointer"
            >
              {editingItem ? "حفظ التعديلات" : "إضافة الصنف للمنيو"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCancelConfirm(true)}
              className="font-bold cursor-pointer"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Confirmation AlertDialog */}
      <AlertDialog open={showSaveConfirm} onOpenChange={setShowSaveConfirm}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-primary flex items-center gap-2">
              <ChefHat size={18} />
              تأكيد حفظ بيانات الصنف
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              هل أنت متأكد من حفظ بيانات صنف{" "}
              <span className="font-bold text-foreground">"{itemForm.name_ar}"</span> في المنيو؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-2">
            <AlertDialogCancel className="font-bold cursor-pointer">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold cursor-pointer"
              onClick={() => upsertItem.mutate()}
            >
              {upsertItem.isPending ? <Loader2 className="animate-spin h-4 w-4" /> : "تأكيد الحفظ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation AlertDialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-black text-amber-600 flex items-center gap-2">
              <AlertTriangle size={18} />
              تأكيد إلغاء التعديل
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              هل أنت متأكد من إلغاء العملية؟ سيتم إغلاق الشاشة وتجاهل جميع البيانات والتعديلات غير
              المحفوظة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 pt-2">
            <AlertDialogCancel className="font-bold cursor-pointer">
              متابعة التعديل
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold cursor-pointer"
              onClick={() => {
                setShowCancelConfirm(false);
                setIsItemModalOpen(false);
                cancelEditItem();
              }}
            >
              نعم، إلغاء وإغلاق
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
        "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition border shrink-0 cursor-pointer " +
        (active
          ? "bg-primary text-primary-foreground border-primary shadow-xs"
          : "bg-card text-foreground border-border hover:border-primary/40")
      }
    >
      {label}
    </button>
  );
}
