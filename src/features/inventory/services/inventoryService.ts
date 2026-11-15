import { supabase } from "@/integrations/supabase/client";
import {
  InventoryItem,
  InventoryTransaction,
  Warehouse,
  WarehouseInventory,
  WarehouseTransfer,
} from "@/shared/types";
import { localWarehouseStore } from "./warehouseStore";
import { menuService } from "@/features/menu/services/menuService";
import { convertToInventoryUnit } from "@/shared/utils/inventoryUtils";
import { erpStore } from "@/shared/services/erpStore";
import { getRawMaterialSpec } from "@/shared/data/defaultRecipes";

export interface UpsertInventoryPayload {
  name_ar: string;
  unit: string;
  quantity: number;
  min_level: number;
  cost: number;
}

export interface CreateTransactionPayload {
  inventory_id: string;
  warehouse_id?: string | null;
  type: string;
  quantity: number;
  note: string | null;
}

export interface CreateWarehousePayload {
  name: string;
  description?: string;
  location?: string;
  is_default?: boolean;
  auto_populate_ingredients?: boolean;
}

export interface TransferInventoryPayload {
  source_warehouse_id: string;
  destination_warehouse_id: string;
  inventory_id: string;
  quantity: number;
  notes?: string;
}

export const inventoryService = {
  async getInventory(): Promise<InventoryItem[]> {
    try {
      const { data, error } = await supabase.from("inventory").select("*").order("name_ar");
      if (error) throw error;
      if (data && data.length > 0) {
        localWarehouseStore.saveInventory(data as InventoryItem[]);
        return data as InventoryItem[];
      }
    } catch {
      // Fallback to local store
    }
    return localWarehouseStore.getInventory();
  },

  async getWarehouses(): Promise<Warehouse[]> {
    try {
      const { data, error } = await (supabase as any)
        .from("warehouses")
        .select("*")
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      if (data && data.length > 0) {
        localWarehouseStore.saveWarehouses(data as Warehouse[]);
        return data as Warehouse[];
      }
    } catch {
      // Fallback
    }
    return localWarehouseStore.getWarehouses();
  },

  async getWarehouseInventory(warehouseId?: string): Promise<WarehouseInventory[]> {
    try {
      let query = (supabase as any).from("warehouse_inventory").select("*");
      if (warehouseId) {
        query = query.eq("warehouse_id" as any, warehouseId);
      }
      const { data, error } = await query;
      if (error) throw error;
      if (data && data.length > 0) {
        return data as WarehouseInventory[];
      }
    } catch {
      // Fallback
    }
    return localWarehouseStore.getWarehouseInventory(warehouseId);
  },

  async getWarehouseTransfers(): Promise<WarehouseTransfer[]> {
    try {
      const { data, error } = await supabase
        .from("warehouse_transfers" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        return data as any as WarehouseTransfer[];
      }
    } catch {
      // Fallback
    }
    return localWarehouseStore.getWarehouseTransfers();
  },

  async createWarehouse(payload: CreateWarehousePayload): Promise<Warehouse> {
    try {
      const { data, error } = await (supabase.rpc as any)("create_warehouse_with_options", {
        p_name: payload.name,
        p_description: payload.description || null,
        p_location: payload.location || null,
        p_is_default: payload.is_default ?? false,
        p_auto_populate_ingredients: payload.auto_populate_ingredients ?? true,
      });
      if (!error && data && data.success && data.warehouse) {
        return data.warehouse as Warehouse;
      }
    } catch {
      // Fallback
    }
    return localWarehouseStore.createWarehouse(payload);
  },

  async updateWarehouse(id: string, payload: Partial<Warehouse>): Promise<Warehouse> {
    try {
      if (payload.is_default) {
        await (supabase as any).from("warehouses").update({ is_default: false }).neq("id", id);
      }
      const { data, error } = await (supabase as any)
        .from("warehouses")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (!error && data) return data as Warehouse;
    } catch {
      // Fallback
    }
    return localWarehouseStore.updateWarehouse(id, payload);
  },

  async deleteWarehouse(id: string): Promise<void> {
    try {
      const { error } = await (supabase as any).from("warehouses").delete().eq("id", id);
      if (!error) return;
    } catch {
      // Fallback
    }
    localWarehouseStore.deleteWarehouse(id);
  },

  async transferInventory(payload: TransferInventoryPayload): Promise<void> {
    try {
      const { data, error } = await (supabase.rpc as any)("transfer_inventory", {
        p_source_warehouse_id: payload.source_warehouse_id,
        p_destination_warehouse_id: payload.destination_warehouse_id,
        p_inventory_id: payload.inventory_id,
        p_quantity: payload.quantity,
        p_notes: payload.notes || null,
      });
      if (!error && data && data.success) {
        return;
      }
    } catch {
      // Fallback
    }
    localWarehouseStore.transferInventory(payload);
  },

  async getTransactions(warehouseId?: string): Promise<InventoryTransaction[]> {
    try {
      let query = supabase.from("inventory_transactions").select("*");
      if (warehouseId) {
        query = query.eq("warehouse_id" as any, warehouseId);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (!error && data) return data as unknown as InventoryTransaction[];
    } catch {
      // Fallback
    }
    return localWarehouseStore.getTransactions(warehouseId);
  },

  async upsertInventoryItem(
    payload: UpsertInventoryPayload,
    id?: string,
    warehouseId?: string,
  ): Promise<InventoryItem> {
    try {
      let item: InventoryItem | null = null;
      if (id) {
        const { data, error } = await supabase
          .from("inventory")
          .update(payload)
          .eq("id", id)
          .select()
          .single();
        if (!error && data) item = data as InventoryItem;
      } else {
        const { data, error } = await supabase.from("inventory").insert(payload).select().single();
        if (!error && data) item = data as InventoryItem;
      }

      if (item) {
        let targetWhId = warehouseId;
        if (!targetWhId) {
          const { data: defaultWh } = await (supabase as any)
            .from("warehouses")
            .select("id")
            .eq("is_default", true)
            .maybeSingle();
          targetWhId = defaultWh?.id;
        }

        if (targetWhId) {
          await (supabase as any).from("warehouse_inventory").upsert(
            {
              warehouse_id: targetWhId,
              inventory_id: item.id,
              quantity: payload.quantity,
              min_level: payload.min_level,
            },
            { onConflict: "warehouse_id,inventory_id" },
          );
        }
        return item;
      }
    } catch {
      // Fallback
    }

    const result = localWarehouseStore.upsertInventoryItem(payload, id, warehouseId);
    try {
      erpStore.recalculateAccountBalances();
      erpStore.notify();
    } catch {
      // Ignore
    }
    return result;
  },

  async deleteInventoryItem(id: string): Promise<void> {
    try {
      const { error } = await supabase.from("inventory").delete().eq("id", id);
      if (!error) return;
    } catch {
      // Fallback
    }
    localWarehouseStore.deleteInventoryItem(id);
    try {
      erpStore.recalculateAccountBalances();
      erpStore.notify();
    } catch {
      // Ignore
    }
  },

  async clearAllInventoryItems(): Promise<void> {
    try {
      await supabase.from("inventory").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    } catch {
      // Fallback
    }
    localWarehouseStore.clearAllInventoryItems();
    try {
      erpStore.recalculateAccountBalances();
      erpStore.notify();
    } catch {
      // Ignore
    }
  },

  async addTransaction(payload: CreateTransactionPayload): Promise<void> {
    try {
      // 1. Insert the transaction record to Supabase (with graceful fallback if warehouse_id column not yet migrated)
      let txErr: any = null;
      const insertPayload: Record<string, any> = {
        inventory_id: payload.inventory_id,
        type: payload.type,
        quantity: payload.quantity,
        note: payload.note || null,
      };
      if (payload.warehouse_id && /^[0-9a-fA-F-]{36}$/.test(payload.warehouse_id)) {
        insertPayload.warehouse_id = payload.warehouse_id;
      }

      const firstAttempt = await (supabase as any)
        .from("inventory_transactions")
        .insert(insertPayload);
      txErr = firstAttempt.error;

      if (txErr && insertPayload.warehouse_id) {
        delete insertPayload.warehouse_id;
        const retryAttempt = await (supabase as any)
          .from("inventory_transactions")
          .insert(insertPayload);
        txErr = retryAttempt.error;
      }

      if (txErr) console.warn("Supabase Transaction insert skipped/failed:", txErr.message);

      // 2. Update target warehouse_inventory in Supabase when valid UUID warehouse_id exists
      if (payload.warehouse_id && /^[0-9a-fA-F-]{36}$/.test(payload.warehouse_id)) {
        const { data: whRow } = await (supabase as any)
          .from("warehouse_inventory")
          .select("quantity")
          .eq("warehouse_id", payload.warehouse_id)
          .eq("inventory_id", payload.inventory_id)
          .maybeSingle();

        const currentWhQty = Number(whRow?.quantity || 0);
        const nextWhQty =
          payload.type === "in"
            ? currentWhQty + payload.quantity
            : payload.type === "out"
              ? currentWhQty - payload.quantity
              : payload.quantity;

        await (supabase as any).from("warehouse_inventory").upsert(
          {
            warehouse_id: payload.warehouse_id,
            inventory_id: payload.inventory_id,
            quantity: nextWhQty,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "warehouse_id,inventory_id" },
        );
      }

      // 3. Update the global inventory summary in Supabase
      const { data: invItem, error: fetchErr } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("id", payload.inventory_id)
        .single();

      if (!fetchErr && invItem) {
        const currentQty = Number(invItem.quantity || 0);
        let newQty = currentQty;
        if (payload.type === "in") {
          newQty = currentQty + payload.quantity;
        } else if (payload.type === "out") {
          newQty = currentQty - payload.quantity;
        } else if (payload.type === "adjustment") {
          newQty = payload.quantity;
        }

        const { error: updateErr } = await supabase
          .from("inventory")
          .update({
            quantity: newQty,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payload.inventory_id);

        if (updateErr) {
          console.error("Supabase Inventory update error:", updateErr);
        }
      }
    } catch (err) {
      console.error("Supabase integration error in addTransaction:", err);
    }

    // 4. Keep localWarehouseStore synced for instant UI updates & offline support
    localWarehouseStore.addTransaction({
      inventory_id: payload.inventory_id,
      warehouse_id: payload.warehouse_id,
      type: payload.type as any,
      quantity: payload.quantity,
      note: payload.note,
    });
  },

  async getOperationalWarehouseId(): Promise<string> {
    try {
      const warehouses = await this.getWarehouses();
      if (!warehouses || warehouses.length === 0) return "wh-sub-kitchen";

      const kitchenMatch = warehouses.find(
        (w) =>
          w.is_active !== false &&
          (w.name.includes("الفرن") || w.name.includes("مطبخ") || w.name.toLowerCase().includes("kitchen")),
      );
      if (kitchenMatch) return kitchenMatch.id;

      const subWarehouse = warehouses.find((w) => w.is_active !== false && !w.is_default);
      if (subWarehouse) return subWarehouse.id;

      return warehouses[0]?.id || "wh-sub-kitchen";
    } catch {
      return "wh-sub-kitchen";
    }
  },

  async deductOrderIngredients(
    orderId: string,
    items: any[],
    orderNumber: number,
    allowNegative: boolean = true,
  ): Promise<{ success: boolean; error?: string; skippedAlreadyDeducted?: boolean }> {
    const OPERATIONAL_WH = await this.getOperationalWarehouseId();
    try {
      // Single-deduction lock check (local + database)
      if (orderId && localWarehouseStore.isOrderDeducted(orderId)) {
        return { success: true, skippedAlreadyDeducted: true };
      }

      const isUuidOrder = Boolean(orderId && /^[0-9a-fA-F-]{36}$/.test(orderId));
      if (isUuidOrder) {
        try {
          const { data: orderRow } = await (supabase as any)
            .from("orders")
            .select("inventory_deducted")
            .eq("id", orderId)
            .maybeSingle();
          if (orderRow?.inventory_deducted === true) {
            localWarehouseStore.markOrderDeducted(orderId);
            return { success: true, skippedAlreadyDeducted: true };
          }
        } catch {
          // Column may not exist prior to migration; proceed using local lock
        }
      }

      // 1. Resolve ingredients (and inventory-linked additions) for all items
      const menuItems = await menuService.getMenuItems();
      const menuMap = Object.fromEntries(menuItems.map((m) => [m.id, m]));

      const allInv = await this.getInventory();
      const allInvMap = Object.fromEntries(allInv.map((i) => [i.id, i]));
      const invByName = new Map(allInv.map((i) => [i.name_ar.trim(), i]));

      const kitchenInv = await this.getWarehouseInventory(OPERATIONAL_WH);
      const kitchenInvMap = Object.fromEntries(kitchenInv.map((i) => [i.inventory_id, i]));

      const requirements: Record<
        string,
        { invId: string; name: string; required: number; available: number; unit: string }
      > = {};

      const addReq = (invItem: InventoryItem, rawQty: number, rawUnit?: string) => {
        if (!invItem || !Number.isFinite(rawQty) || rawQty <= 0) return;
        const needed = convertToInventoryUnit(rawQty, rawUnit || invItem.unit, invItem.unit);
        if (!requirements[invItem.id]) {
          requirements[invItem.id] = {
            invId: invItem.id,
            name: invItem.name_ar,
            required: 0,
            available: Number(kitchenInvMap[invItem.id]?.quantity ?? 0),
            unit: invItem.unit,
          };
        }
        requirements[invItem.id].required += needed;
      };

      const itemsList = Array.isArray(items)
        ? items
        : typeof items === "string"
          ? (() => {
              try {
                return JSON.parse(items);
              } catch {
                return [];
              }
            })()
          : [];

      for (const item of itemsList) {
        if (!item) continue;
        const qty = Number(item.quantity || 1);
        const menuItemId = item.menu_item_id || item.id;
        const menuItem = menuMap[menuItemId];

        if (menuItem) {
          const ingredients = menuItem.ingredients || [];
          for (const ing of ingredients) {
            const masterInvItem = allInvMap[ing.inventory_id];
            if (!masterInvItem) continue;
            addReq(masterInvItem, Number(ing.weight || 0) * qty, ing.unit);
          }
        }

        // Deduct only inventory-linked selected additions
        const selectedAdds = Array.isArray(item.selectedAdditions) ? item.selectedAdditions : [];
        for (const add of selectedAdds) {
          if (!add || typeof add !== "object") continue;
          const deductQty = Number(add.deduct_qty || 0);
          if (deductQty <= 0) continue;

          let masterInvItem = add.inventory_id ? allInvMap[add.inventory_id] : undefined;
          if (!masterInvItem && add.materialKey) {
            const spec = getRawMaterialSpec(add.materialKey);
            if (spec) masterInvItem = invByName.get(spec.name_ar.trim());
          }
          if (masterInvItem) {
            addReq(masterInvItem, deductQty * qty, add.deduct_unit || masterInvItem.unit);
          }
        }
      }

      // 2. Validate availability if negative stock is disallowed
      if (!allowNegative) {
        const insufficient = Object.values(requirements).filter((r) => r.required > r.available);
        if (insufficient.length > 0) {
          const msg = insufficient
            .map(
              (i) => `• ${i.name}: مطلوب ${i.required.toFixed(2)} المتاح ${i.available.toFixed(2)}`,
            )
            .join("\n");
          return { success: false, error: `عجز في المخزون بمخزن الفرن والمطبخ:\n${msg}` };
        }
      }

      // 3. Deduct
      for (const req of Object.values(requirements)) {
        await this.addTransaction({
          inventory_id: req.invId,
          warehouse_id: OPERATIONAL_WH,
          type: "out",
          quantity: req.required,
          note: `خصم تحضير آلي - طلب #${orderNumber}`,
        });
      }

      // 4. Mark single-deduction lock locally & in DB
      if (orderId) {
        localWarehouseStore.markOrderDeducted(orderId);
        if (isUuidOrder) {
          try {
            await (supabase as any)
              .from("orders")
              .update({ inventory_deducted: true })
              .eq("id", orderId);
          } catch {
            // ignore schema mismatch
          }
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error("Error in deductOrderIngredients:", err);
      return { success: false, error: err.message };
    }
  },

  async restoreOrderIngredients(
    orderId: string,
    items: any[],
    orderNumber: number,
  ): Promise<{ success: boolean; error?: string; skippedNotDeducted?: boolean }> {
    const OPERATIONAL_WH = await this.getOperationalWarehouseId();
    try {
      const isUuidOrder = Boolean(orderId && /^[0-9a-fA-F-]{36}$/.test(orderId));
      let dbDeducted: boolean | null = null;
      if (isUuidOrder) {
        try {
          const { data: orderRow } = await (supabase as any)
            .from("orders")
            .select("inventory_deducted")
            .eq("id", orderId)
            .maybeSingle();
          if (typeof orderRow?.inventory_deducted === "boolean") {
            dbDeducted = orderRow.inventory_deducted;
          }
        } catch {
          dbDeducted = null;
        }
      }

      const localDeducted = orderId ? localWarehouseStore.isOrderDeducted(orderId) : false;
      if (dbDeducted === false && !localDeducted) {
        return { success: true, skippedNotDeducted: true };
      }

      const menuItems = await menuService.getMenuItems();
      const menuMap = Object.fromEntries(menuItems.map((m) => [m.id, m]));
      const allInv = await this.getInventory();
      const allInvMap = Object.fromEntries(allInv.map((i) => [i.id, i]));
      const invByName = new Map(allInv.map((i) => [i.name_ar.trim(), i]));

      const requirements: Record<string, { invId: string; required: number }> = {};
      const addRestore = (invItem: InventoryItem, rawQty: number, rawUnit?: string) => {
        if (!invItem || !Number.isFinite(rawQty) || rawQty <= 0) return;
        const totalNeeded = convertToInventoryUnit(rawQty, rawUnit || invItem.unit, invItem.unit);
        if (!requirements[invItem.id]) {
          requirements[invItem.id] = { invId: invItem.id, required: 0 };
        }
        requirements[invItem.id].required += totalNeeded;
      };

      const itemsList = Array.isArray(items)
        ? items
        : typeof items === "string"
          ? (() => {
              try {
                return JSON.parse(items);
              } catch {
                return [];
              }
            })()
          : [];

      for (const item of itemsList) {
        if (!item) continue;
        const qty = Number(item.quantity || 1);
        const menuItemId = item.menu_item_id || item.id;
        const menuItem = menuMap[menuItemId];
        if (menuItem) {
          const ingredients = menuItem.ingredients || [];
          for (const ing of ingredients) {
            const masterInvItem = allInvMap[ing.inventory_id];
            if (!masterInvItem) continue;
            addRestore(masterInvItem, Number(ing.weight || 0) * qty, ing.unit);
          }
        }

        const selectedAdds = Array.isArray(item.selectedAdditions) ? item.selectedAdditions : [];
        for (const add of selectedAdds) {
          if (!add || typeof add !== "object") continue;
          const deductQty = Number(add.deduct_qty || 0);
          if (deductQty <= 0) continue;

          let masterInvItem = add.inventory_id ? allInvMap[add.inventory_id] : undefined;
          if (!masterInvItem && add.materialKey) {
            const spec = getRawMaterialSpec(add.materialKey);
            if (spec) masterInvItem = invByName.get(spec.name_ar.trim());
          }
          if (masterInvItem) {
            addRestore(masterInvItem, deductQty * qty, add.deduct_unit || masterInvItem.unit);
          }
        }
      }

      // Restore
      for (const req of Object.values(requirements)) {
        await this.addTransaction({
          inventory_id: req.invId,
          warehouse_id: OPERATIONAL_WH,
          type: "in",
          quantity: req.required,
          note: `إرجاع إلغاء طلب - طلب #${orderNumber}`,
        });
      }

      if (orderId) {
        localWarehouseStore.unmarkOrderDeducted(orderId);
        if (isUuidOrder) {
          try {
            await (supabase as any)
              .from("orders")
              .update({ inventory_deducted: false })
              .eq("id", orderId);
          } catch {
            // ignore schema mismatch
          }
        }
      }

      return { success: true };
    } catch (err: any) {
      console.error("Error in restoreOrderIngredients:", err);
      return { success: false, error: err.message };
    }
  },
};
