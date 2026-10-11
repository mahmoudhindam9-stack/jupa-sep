import { supabase } from "@/integrations/supabase/client";
import { Category, MenuItem } from "@/shared/types";

const LOCAL_ITEMS_KEY = "local_custom_menu_items";
const LOCAL_DELETED_ITEMS_KEY = "local_deleted_menu_items";
const LOCAL_CATEGORIES_KEY = "local_custom_categories";
const LOCAL_DELETED_CATS_KEY = "local_deleted_categories";
const LOCAL_RECIPES_KEY = "local_menu_ingredients";
const LOCAL_TRACKING_KEY = "local_inventory_tracking";

function getLocal<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error(`Error reading ${key} from localStorage:`, e);
    return fallback;
  }
}

function setLocal<T>(key: string, val: T): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error(`Error writing ${key} to localStorage:`, e);
  }
}

function isRLSorPermissionError(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || "");
  const msg = String(err.message || "").toLowerCase();
  const status = Number(err.status || 0);
  return (
    code === "42501" ||
    status === 401 ||
    status === 403 ||
    msg.includes("row-level security") ||
    msg.includes("violates row-level security policy") ||
    msg.includes("permission denied") ||
    msg.includes("unauthorized")
  );
}

export const menuService = {
  async getCategories(): Promise<Category[]> {
    const localCustomCats = getLocal<Record<string, Category>>(LOCAL_CATEGORIES_KEY, {});
    const localDeletedCats = new Set(getLocal<string[]>(LOCAL_DELETED_CATS_KEY, []));

    // Ensure default categories exist if none exist locally
    if (Object.keys(localCustomCats).length === 0) {
      const defaultCats: Category[] = [
        { id: "cat-1", name_ar: "البرجر والسندويتشات", sort_order: 1 },
        { id: "cat-2", name_ar: "المشويات واللحوم", sort_order: 2 },
        { id: "cat-3", name_ar: "المشروبات والعصائر", sort_order: 3 },
        { id: "cat-4", name_ar: "الحلويات والمقبلات", sort_order: 4 },
      ];
      setLocal(LOCAL_CATEGORIES_KEY, Object.fromEntries(defaultCats.map((c) => [c.id, c])));
    }

    let dbCategories: Category[] = [];
    try {
      const queryPromise = supabase.from("menu_categories").select("*").order("sort_order");

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Supabase timeout")), 1200),
      );

      const { data, error } = (await Promise.race([queryPromise, timeoutPromise])) as any;
      if (!error && data && data.length > 0) {
        dbCategories = data as Category[];
      }
    } catch (e) {
      // Ignore background fetch error, use local
    }

    const latestLocalCats = getLocal<Record<string, Category>>(LOCAL_CATEGORIES_KEY, {});
    const resultMap = new Map<string, Category>();

    for (const cat of dbCategories) {
      if (!localDeletedCats.has(cat.id)) {
        resultMap.set(cat.id, cat);
      }
    }

    for (const cat of Object.values(latestLocalCats)) {
      if (!localDeletedCats.has(cat.id)) {
        resultMap.set(cat.id, cat);
      }
    }

    let finalCats = Array.from(resultMap.values()).sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    if (finalCats.length === 0) {
      finalCats = [
        { id: "cat-1", name_ar: "البرجر والسندويتشات", sort_order: 1 },
        { id: "cat-2", name_ar: "المشويات واللحوم", sort_order: 2 },
        { id: "cat-3", name_ar: "المشروبات والعصائر", sort_order: 3 },
        { id: "cat-4", name_ar: "الحلويات والمقبلات", sort_order: 4 },
      ];
    }
    return finalCats;
  },

  async getMenuItems(onlyAvailable = false): Promise<MenuItem[]> {
    const localCustomItems = getLocal<Record<string, MenuItem>>(LOCAL_ITEMS_KEY, {});

    // Ensure default items exist if none exist locally
    if (Object.keys(localCustomItems).length === 0) {
      const defaultItems: MenuItem[] = [
        {
          id: "item-1",
          name_ar: "برجر جوبا الخاص",
          price: 180,
          category_id: "cat-1",
          is_available: true,
          requires_oven: true,
          image_url:
            "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=60",
          ingredients: [],
        },
        {
          id: "item-2",
          name_ar: "تشيز برجر دبل",
          price: 210,
          category_id: "cat-1",
          is_available: true,
          requires_oven: true,
          image_url:
            "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=500&auto=format&fit=crop&q=60",
          ingredients: [],
        },
        {
          id: "item-3",
          name_ar: "مشاوي كباب وكفته",
          price: 320,
          category_id: "cat-2",
          is_available: true,
          requires_oven: true,
          image_url:
            "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=500&auto=format&fit=crop&q=60",
          ingredients: [],
        },
        {
          id: "item-4",
          name_ar: "فرخة مشوية عالفحم",
          price: 290,
          category_id: "cat-2",
          is_available: true,
          requires_oven: true,
          image_url:
            "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?w=500&auto=format&fit=crop&q=60",
          ingredients: [],
        },
        {
          id: "item-5",
          name_ar: "عصير مانجو طازج",
          price: 50,
          category_id: "cat-3",
          is_available: true,
          requires_oven: false,
          image_url:
            "https://images.unsplash.com/photo-1546173159-315724a31696?w=500&auto=format&fit=crop&q=60",
          ingredients: [],
        },
        {
          id: "item-6",
          name_ar: "بيبسي / كوكاكولا",
          price: 25,
          category_id: "cat-3",
          is_available: true,
          requires_oven: false,
          image_url:
            "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=60",
          ingredients: [],
        },
        {
          id: "item-7",
          name_ar: "بطاطس مقلية",
          price: 40,
          category_id: "cat-4",
          is_available: true,
          requires_oven: true,
          image_url:
            "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500&auto=format&fit=crop&q=60",
          ingredients: [],
        },
        {
          id: "item-8",
          name_ar: "كنافة بالقشطة",
          price: 65,
          category_id: "cat-4",
          is_available: true,
          requires_oven: false,
          image_url:
            "https://images.unsplash.com/photo-1579372786545-d24232daf58c?w=500&auto=format&fit=crop&q=60",
          ingredients: [],
        },
      ];
      setLocal(LOCAL_ITEMS_KEY, Object.fromEntries(defaultItems.map((i) => [i.id, i])));
    }

    let dbData: any[] = [];
    try {
      let query = supabase
        .from("menu_items")
        .select(
          `
          *,
          recipes (
            id,
            notes,
            recipe_ingredients (
              inventory_id,
              weight,
              quantity,
              unit,
              optional,
              waste_percent,
              notes
            )
          )
        `,
        )
        .order("created_at");

      if (onlyAvailable) {
        query = query.eq("is_available", true);
      }

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Supabase timeout")), 1200),
      );

      const { data: resData, error } = (await Promise.race([query, timeoutPromise])) as any;
      if (!error && resData && resData.length > 0) {
        dbData = resData;
      }
    } catch (e) {
      // Ignore background fetch error, use local
    }

    const localRecipes = getLocal<Record<string, any[]>>(LOCAL_RECIPES_KEY, {});
    const localTracking = getLocal<Record<string, string>>(LOCAL_TRACKING_KEY, {});
    const latestLocalItems = getLocal<Record<string, MenuItem>>(LOCAL_ITEMS_KEY, {});
    const localDeletedItems = new Set(getLocal<string[]>(LOCAL_DELETED_ITEMS_KEY, []));

    const resultMap = new Map<string, MenuItem>();

    // Process DB items
    for (const item of dbData) {
      if (localDeletedItems.has(item.id)) continue;

      const recipe = item.recipes?.[0];
      const dbIngredients =
        recipe?.recipe_ingredients?.map((ing: any) => ({
          inventory_id: ing.inventory_id,
          weight: Number(ing.weight ?? ing.quantity ?? 0),
          unit: ing.unit,
          optional: ing.optional,
          waste_percent: ing.waste_percent,
          notes: ing.notes,
        })) || [];

      const ingredientsList =
        dbIngredients.length > 0
          ? dbIngredients
          : Array.isArray(item.ingredients) && item.ingredients.length > 0
            ? item.ingredients
            : localRecipes[item.id] || [];

      const trackingMode =
        item.inventory_tracking ||
        localTracking[item.id] ||
        (ingredientsList.length > 0 ? "recipe_required" : "not_tracked");

      const requiresOven = item.requires_oven ?? latestLocalItems[item.id]?.requires_oven ?? false;

      resultMap.set(item.id, {
        ...(latestLocalItems[item.id] || {}),
        ...item,
        requires_oven: requiresOven,
        inventory_tracking: trackingMode,
        ingredients: ingredientsList,
      } as MenuItem);
    }

    // Process local custom items not in DB
    for (const item of Object.values(latestLocalItems)) {
      if (localDeletedItems.has(item.id)) continue;
      if (!resultMap.has(item.id)) {
        resultMap.set(item.id, item);
      }
    }

    let items = Array.from(resultMap.values());
    if (items.length === 0) {
      items = [
        {
          id: "item-1",
          name_ar: "برجر جوبا الخاص",
          price: 180,
          category_id: "cat-1",
          is_available: true,
          requires_oven: true,
          image_url: null,
          ingredients: [],
        },
        {
          id: "item-2",
          name_ar: "تشيز برجر دبل",
          price: 210,
          category_id: "cat-1",
          is_available: true,
          requires_oven: true,
          image_url: null,
          ingredients: [],
        },
        {
          id: "item-3",
          name_ar: "مشاوي كباب وكفته",
          price: 320,
          category_id: "cat-2",
          is_available: true,
          requires_oven: true,
          image_url: null,
          ingredients: [],
        },
        {
          id: "item-4",
          name_ar: "فرخة مشوية عالفحم",
          price: 290,
          category_id: "cat-2",
          is_available: true,
          requires_oven: true,
          image_url: null,
          ingredients: [],
        },
        {
          id: "item-5",
          name_ar: "عصير مانجو طازج",
          price: 50,
          category_id: "cat-3",
          is_available: true,
          requires_oven: false,
          image_url: null,
          ingredients: [],
        },
        {
          id: "item-6",
          name_ar: "بيبسي / كوكاكولا",
          price: 25,
          category_id: "cat-3",
          is_available: true,
          requires_oven: false,
          image_url: null,
          ingredients: [],
        },
        {
          id: "item-7",
          name_ar: "بطاطس مقلية",
          price: 40,
          category_id: "cat-4",
          is_available: true,
          requires_oven: true,
          image_url: null,
          ingredients: [],
        },
        {
          id: "item-8",
          name_ar: "كنافة بالقشطة",
          price: 65,
          category_id: "cat-4",
          is_available: true,
          requires_oven: false,
          image_url: null,
          ingredients: [],
        },
      ];
    }
    if (onlyAvailable) {
      items = items.filter((i) => i.is_available);
    }

    return items;
  },

  async upsertCategory(
    payload: { name_ar: string; sort_order: number },
    id?: string,
  ): Promise<Category> {
    try {
      if (id) {
        const { data, error } = await supabase
          .from("menu_categories")
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data as Category;
      } else {
        const { data, error } = await supabase
          .from("menu_categories")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return data as Category;
      }
    } catch (err: any) {
      console.warn("Supabase category write failed, storing locally:", err);
      const catId = id || `cat_local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const localCat: Category = {
        id: catId,
        name_ar: payload.name_ar,
        sort_order: payload.sort_order,
        created_at: new Date().toISOString(),
      };

      const localCats = getLocal<Record<string, Category>>(LOCAL_CATEGORIES_KEY, {});
      localCats[catId] = localCat;
      setLocal(LOCAL_CATEGORIES_KEY, localCats);

      return localCat;
    }
  },

  async deleteCategory(id: string): Promise<void> {
    const localCats = getLocal<Record<string, Category>>(LOCAL_CATEGORIES_KEY, {});
    delete localCats[id];
    setLocal(LOCAL_CATEGORIES_KEY, localCats);

    const localDeleted = getLocal<string[]>(LOCAL_DELETED_CATS_KEY, []);
    if (!localDeleted.includes(id)) {
      localDeleted.push(id);
      setLocal(LOCAL_DELETED_CATS_KEY, localDeleted);
    }

    try {
      await supabase.from("menu_categories").delete().eq("id", id);
    } catch (e) {
      console.warn("Supabase category delete failed (using local fallback):", e);
    }
  },

  async upsertMenuItem(payload: Partial<MenuItem>, id?: string): Promise<MenuItem> {
    const trackingMode = payload.inventory_tracking || "not_tracked";
    const formattedPayload: any = {
      name_ar: payload.name_ar || "",
      price: Number(payload.price),
      category_id: payload.category_id || null,
      image_url: payload.image_url || null,
      is_available: payload.is_available ?? true,
      requires_oven: payload.requires_oven ?? false,
      ingredients: payload.ingredients || [],
      inventory_tracking: trackingMode,
      badge: payload.badge || null,
      additions: payload.additions || [],
    };

    let resultItem: any = null;

    try {
      if (id) {
        const { data, error } = await supabase
          .from("menu_items")
          .update(formattedPayload)
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        resultItem = data;
      } else {
        const { data, error } = await supabase
          .from("menu_items")
          .insert(formattedPayload)
          .select()
          .single();
        if (error) throw error;
        resultItem = data;
      }
    } catch (err: any) {
      if (isRLSorPermissionError(err)) {
        console.warn("Supabase RLS policy blocked write, persisting item locally.", err);
      } else {
        const isSchemaError =
          err?.code === "42703" ||
          err?.code === "PGRST204" ||
          err?.message?.includes("ingredients") ||
          err?.message?.includes("inventory_tracking") ||
          err?.message?.includes("requires_oven") ||
          err?.message?.includes("column") ||
          err?.message?.includes("schema cache");

        if (isSchemaError) {
          console.warn("Schema cache missing columns in Supabase. Trying fallback write.", err);
          const fallbackPayload = { ...formattedPayload };
          delete fallbackPayload.ingredients;
          delete fallbackPayload.inventory_tracking;
          delete fallbackPayload.requires_oven;
          delete fallbackPayload.badge;
          delete fallbackPayload.additions;

          try {
            if (id) {
              const { data, error } = await supabase
                .from("menu_items")
                .update(fallbackPayload)
                .eq("id", id)
                .select()
                .single();
              if (error) throw error;
              resultItem = data;
            } else {
              const { data, error } = await supabase
                .from("menu_items")
                .insert(fallbackPayload)
                .select()
                .single();
              if (error) throw error;
              resultItem = data;
            }
          } catch (fallbackErr: any) {
            console.warn("Fallback DB write also failed, storing locally:", fallbackErr);
          }
        } else {
          console.warn("Supabase write failed, falling back to local storage:", err);
        }
      }
    }

    // Save local copy / overrides regardless so UI always succeeds
    const itemId =
      id ||
      resultItem?.id ||
      `item_local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const finalItem: MenuItem = {
      id: itemId,
      name_ar: formattedPayload.name_ar,
      price: formattedPayload.price,
      category_id: formattedPayload.category_id,
      image_url: formattedPayload.image_url,
      is_available: formattedPayload.is_available,
      requires_oven: formattedPayload.requires_oven,
      inventory_tracking: trackingMode,
      ingredients: formattedPayload.ingredients,
      badge: formattedPayload.badge,
      additions: formattedPayload.additions || [],
      created_at: resultItem?.created_at || new Date().toISOString(),
    };

    // Save in local storage
    const localItems = getLocal<Record<string, MenuItem>>(LOCAL_ITEMS_KEY, {});
    localItems[itemId] = finalItem;
    setLocal(LOCAL_ITEMS_KEY, localItems);

    const localRecipes = getLocal<Record<string, any[]>>(LOCAL_RECIPES_KEY, {});
    localRecipes[itemId] = formattedPayload.ingredients;
    setLocal(LOCAL_RECIPES_KEY, localRecipes);

    const localTracking = getLocal<Record<string, string>>(LOCAL_TRACKING_KEY, {});
    localTracking[itemId] = trackingMode;
    setLocal(LOCAL_TRACKING_KEY, localTracking);

    // Keep recipe DB tables in sync if DB item exists
    if (resultItem?.id) {
      try {
        const { data: recipe, error: recError } = await (supabase as any)
          .from("recipes")
          .upsert(
            { menu_item_id: resultItem.id, notes: "وصفة مضافة من لوحة التحكم" },
            { onConflict: "menu_item_id" },
          )
          .select("id")
          .single();

        if (!recError && recipe) {
          await (supabase as any).from("recipe_ingredients").delete().eq("recipe_id", recipe.id);
          const ingredients = formattedPayload.ingredients || [];
          if (ingredients.length > 0) {
            const rows = ingredients.map((ing: any) => ({
              recipe_id: recipe.id,
              inventory_id: ing.inventory_id,
              quantity: Number(ing.weight || ing.quantity || 0),
              weight: Number(ing.weight || ing.quantity || 0),
              unit: ing.unit || "pcs",
              optional: ing.optional || false,
              waste_percent: ing.waste_percent ? Number(ing.waste_percent) : null,
              notes: ing.notes || null,
            }));
            await (supabase as any).from("recipe_ingredients").insert(rows);
          }
        }
      } catch (recErr) {
        console.error("Error syncing recipe DB tables:", recErr);
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("menu_updated"));
    }

    return finalItem;
  },

  async deleteMenuItem(id: string): Promise<void> {
    const localItems = getLocal<Record<string, MenuItem>>(LOCAL_ITEMS_KEY, {});
    delete localItems[id];
    setLocal(LOCAL_ITEMS_KEY, localItems);

    const localRecipes = getLocal<Record<string, any[]>>(LOCAL_RECIPES_KEY, {});
    delete localRecipes[id];
    setLocal(LOCAL_RECIPES_KEY, localRecipes);

    const localTracking = getLocal<Record<string, string>>(LOCAL_TRACKING_KEY, {});
    delete localTracking[id];
    setLocal(LOCAL_TRACKING_KEY, localTracking);

    const localDeleted = getLocal<string[]>(LOCAL_DELETED_ITEMS_KEY, []);
    if (!localDeleted.includes(id)) {
      localDeleted.push(id);
      setLocal(LOCAL_DELETED_ITEMS_KEY, localDeleted);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("menu_updated"));
    }

    try {
      // Find recipe linked to this menu item
      const { data: recipes } = await (supabase as any)
        .from("recipes")
        .select("id")
        .eq("menu_item_id", id);

      if (recipes && recipes.length > 0) {
        for (const rec of recipes) {
          await (supabase as any).from("recipe_ingredients").delete().eq("recipe_id", rec.id);
        }
        await (supabase as any).from("recipes").delete().eq("menu_item_id", id);
      }

      await supabase.from("menu_items").delete().eq("id", id);
    } catch (e) {
      console.warn("Supabase menu item delete failed (using local fallback):", e);
    }
  },

  async toggleMenuItemAvailability(id: string, isAvailable: boolean): Promise<void> {
    const localItems = getLocal<Record<string, MenuItem>>(LOCAL_ITEMS_KEY, {});
    if (localItems[id]) {
      localItems[id].is_available = isAvailable;
      setLocal(LOCAL_ITEMS_KEY, localItems);
    }

    try {
      const { error } = await supabase
        .from("menu_items")
        .update({ is_available: isAvailable })
        .eq("id", id);

      if (error) {
        console.warn("Supabase toggle availability error, saved locally:", error);
      }
    } catch (e) {
      console.warn("Failed to update availability on Supabase:", e);
    }
  },
};
