import {
  InventoryItem,
  InventoryTransaction,
  Warehouse,
  WarehouseInventory,
  WarehouseTransfer,
} from "@/shared/types";

const WAREHOUSES_KEY = "ydb_warehouses_v2";
const WAREHOUSE_INV_KEY = "ydb_warehouse_inventory_v2";
const WAREHOUSE_TRANSFERS_KEY = "ydb_warehouse_transfers_v2";
const INVENTORY_ITEMS_KEY = "ydb_inventory_items_v2";
const INVENTORY_INITIALIZED_KEY = "ydb_inventory_initialized_v2";
const TRANSACTIONS_KEY = "ydb_inventory_transactions_v2";

const DEFAULT_WAREHOUSES: Warehouse[] = [
  {
    id: "wh-main-default",
    name: "المخزن الرئيسي",
    description: "المخزن الرئيسي لاستلام المشتريات وتخزين الخامات الأساسية",
    location: "الفرع الثاني - المخزن الرئيسي",
    is_active: true,
    is_default: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "wh-sub-kitchen",
    name: "مخزن الفرن والمطبخ",
    description: "مخزن المطبخ والفرن والتشغيل اليومي - يتم الخصم منه عند البيع",
    location: "الفرع الثاني - منطقة التشغيل",
    is_active: true,
    is_default: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const DEFAULT_INVENTORY_SEED: InventoryItem[] = [
  {
    id: "inv-seed-1",
    name_ar: "دقيق نقي للمخبوزات والبيتزا",
    unit: "كيلو",
    quantity: 150,
    min_level: 20,
    cost: 25,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inv-seed-2",
    name_ar: "جبنة موتزاريلا طبيعي",
    unit: "كيلو",
    quantity: 80,
    min_level: 15,
    cost: 180,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inv-seed-3",
    name_ar: "صلصة طماطم ايطالي ممتازة",
    unit: "كيلو",
    quantity: 60,
    min_level: 10,
    cost: 45,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inv-seed-4",
    name_ar: "لحم مفروم بلدي طازج",
    unit: "كيلو",
    quantity: 100,
    min_level: 15,
    cost: 320,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inv-seed-5",
    name_ar: "صدور دجاج مخلية",
    unit: "كيلو",
    quantity: 120,
    min_level: 20,
    cost: 190,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inv-seed-6",
    name_ar: "شرائح بيبروني بقرى",
    unit: "كيلو",
    quantity: 40,
    min_level: 8,
    cost: 280,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inv-seed-7",
    name_ar: "خضروات مشكلة طازجة",
    unit: "كيلو",
    quantity: 90,
    min_level: 15,
    cost: 30,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inv-seed-8",
    name_ar: "زيت زيتون بكر ممتاز",
    unit: "لتر",
    quantity: 50,
    min_level: 10,
    cost: 160,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inv-seed-9",
    name_ar: "خيار مخلل مقطع",
    unit: "كيلو",
    quantity: 35,
    min_level: 5,
    cost: 25,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inv-seed-10",
    name_ar: "بطاطس نصف مقلية فريتس",
    unit: "كيلو",
    quantity: 200,
    min_level: 30,
    cost: 50,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inv-seed-11",
    name_ar: "كوكاكولا كانز 330 مل",
    unit: "علبة",
    quantity: 300,
    min_level: 50,
    cost: 12,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inv-seed-12",
    name_ar: "عصير برتقال طازج",
    unit: "لتر",
    quantity: 80,
    min_level: 15,
    cost: 25,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inv-seed-13",
    name_ar: "شاي بنعناع طازج",
    unit: "باكيت",
    quantity: 500,
    min_level: 50,
    cost: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inv-seed-14",
    name_ar: "قهوة تركي بن مطحون",
    unit: "كيلو",
    quantity: 15,
    min_level: 3,
    cost: 400,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inv-seed-15",
    name_ar: "سميد وبسبوسة",
    unit: "كيلو",
    quantity: 45,
    min_level: 10,
    cost: 35,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "inv-seed-16",
    name_ar: "قشطة بلدي طازجة",
    unit: "كيلو",
    quantity: 30,
    min_level: 5,
    cost: 110,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export class LocalWarehouseStore {
  private getItem<T>(key: string, fallback: T): T {
    if (typeof window === "undefined" || !window.localStorage) return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  private setItem<T>(key: string, val: T): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    localStorage.setItem(key, JSON.stringify(val));
  }

  // --- Warehouses ---
  getWarehouses(): Warehouse[] {
    let list = this.getItem<Warehouse[]>(WAREHOUSES_KEY, []);
    if (list.length === 0) {
      list = DEFAULT_WAREHOUSES;
      this.setItem(WAREHOUSES_KEY, list);
    }
    return list;
  }

  saveWarehouses(list: Warehouse[]): void {
    this.setItem(WAREHOUSES_KEY, list);
  }

  createWarehouse(payload: {
    name: string;
    description?: string;
    location?: string;
    is_default?: boolean;
    auto_populate_ingredients?: boolean;
  }): Warehouse {
    const list = this.getWarehouses();
    const isDefault = payload.is_default || list.length === 0;

    if (isDefault) {
      list.forEach((w) => (w.is_default = false));
    }

    const newWh: Warehouse = {
      id: "wh-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      name: payload.name,
      description: payload.description || null,
      location: payload.location || null,
      is_active: true,
      is_default: isDefault,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    list.push(newWh);
    this.saveWarehouses(list);

    if (payload.auto_populate_ingredients ?? true) {
      this.populateWarehouseIngredients(newWh.id);
    }

    return newWh;
  }

  updateWarehouse(id: string, payload: Partial<Warehouse>): Warehouse {
    const list = this.getWarehouses();
    const idx = list.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error("المخزن غير موجود");

    if (payload.is_default) {
      list.forEach((w) => (w.is_default = false));
    }

    list[idx] = {
      ...list[idx],
      ...payload,
      updated_at: new Date().toISOString(),
    };

    this.saveWarehouses(list);
    return list[idx];
  }

  deleteWarehouse(id: string): void {
    let list = this.getWarehouses();
    const wh = list.find((w) => w.id === id);
    if (!wh) return;
    if (wh.is_default) {
      throw new Error("لا يمكن حذف المخزن الافتراضي للمطعم");
    }
    list = list.filter((w) => w.id !== id);
    this.saveWarehouses(list);
  }

  // --- Inventory Items ---
  getInventory(): InventoryItem[] {
    const isInitialized = this.getItem<boolean>(INVENTORY_INITIALIZED_KEY, false);
    let list = this.getItem<InventoryItem[]>(INVENTORY_ITEMS_KEY, []);
    if (!isInitialized && list.length === 0) {
      list = DEFAULT_INVENTORY_SEED;
      this.setItem(INVENTORY_ITEMS_KEY, list);
      this.setItem(INVENTORY_INITIALIZED_KEY, true);

      // Auto link seed items with default warehouse
      const defaultWh = this.getWarehouses().find((w) => w.is_default) || this.getWarehouses()[0];
      if (defaultWh) {
        const whInv = this.getWarehouseInventory();
        DEFAULT_INVENTORY_SEED.forEach((item) => {
          if (
            !whInv.some((row) => row.warehouse_id === defaultWh.id && row.inventory_id === item.id)
          ) {
            whInv.push({
              id: "whinv-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
              warehouse_id: defaultWh.id,
              inventory_id: item.id,
              quantity: item.quantity,
              min_level: item.min_level,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        });
        this.saveWarehouseInventory(whInv);
      }
    }
    return list;
  }

  saveInventory(list: InventoryItem[]): void {
    this.setItem(INVENTORY_ITEMS_KEY, list);
    this.setItem(INVENTORY_INITIALIZED_KEY, true);
  }

  clearAllInventoryItems(): void {
    this.setItem(INVENTORY_ITEMS_KEY, []);
    this.setItem(INVENTORY_INITIALIZED_KEY, true);
    this.setItem(WAREHOUSE_INV_KEY, []);
  }

  upsertInventoryItem(
    payload: {
      name_ar: string;
      unit: string;
      quantity: number;
      min_level: number;
      cost: number;
    },
    id?: string,
    warehouseId?: string,
  ): InventoryItem {
    const list = this.getInventory();
    let item: InventoryItem;

    if (id) {
      const idx = list.findIndex((i) => i.id === id);
      if (idx !== -1) {
        list[idx] = {
          ...list[idx],
          name_ar: payload.name_ar,
          unit: payload.unit,
          quantity: payload.quantity,
          min_level: payload.min_level,
          cost: payload.cost,
          updated_at: new Date().toISOString(),
        };
        item = list[idx];
      } else {
        item = {
          id,
          name_ar: payload.name_ar,
          unit: payload.unit,
          quantity: payload.quantity,
          min_level: payload.min_level,
          cost: payload.cost,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        list.push(item);
      }
    } else {
      item = {
        id: "inv-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
        name_ar: payload.name_ar,
        unit: payload.unit,
        quantity: payload.quantity,
        min_level: payload.min_level,
        cost: payload.cost,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      list.push(item);
    }

    this.saveInventory(list);

    // Update or link with targeted warehouse stock
    const whList = this.getWarehouses();
    const targetWhId = warehouseId || whList.find((w) => w.is_default)?.id || whList[0]?.id;
    if (targetWhId) {
      const whInv = this.getWarehouseInventory();
      const whIdx = whInv.findIndex(
        (r) => r.warehouse_id === targetWhId && r.inventory_id === item.id,
      );
      if (whIdx !== -1) {
        whInv[whIdx].quantity = payload.quantity;
        whInv[whIdx].min_level = payload.min_level;
        whInv[whIdx].updated_at = new Date().toISOString();
      } else {
        whInv.push({
          id: "whinv-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
          warehouse_id: targetWhId,
          inventory_id: item.id,
          quantity: payload.quantity,
          min_level: payload.min_level,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
      this.saveWarehouseInventory(whInv);
    }

    return item;
  }

  deleteInventoryItem(id: string): void {
    let list = this.getInventory();
    list = list.filter((i) => i.id !== id);
    this.saveInventory(list);

    // Clean up warehouse stock
    let whInv = this.getWarehouseInventory();
    whInv = whInv.filter((r) => r.inventory_id !== id);
    this.saveWarehouseInventory(whInv);
  }

  // --- Warehouse Stock Levels ---
  getWarehouseInventory(warehouseId?: string): WarehouseInventory[] {
    const list = this.getItem<WarehouseInventory[]>(WAREHOUSE_INV_KEY, []);
    if (warehouseId) {
      return list.filter((r) => r.warehouse_id === warehouseId);
    }
    return list;
  }

  saveWarehouseInventory(list: WarehouseInventory[]): void {
    this.setItem(WAREHOUSE_INV_KEY, list);
  }

  populateWarehouseIngredients(warehouseId: string): number {
    const invList = this.getInventory();
    const whInv = this.getWarehouseInventory();
    let added = 0;

    invList.forEach((inv) => {
      if (!whInv.some((r) => r.warehouse_id === warehouseId && r.inventory_id === inv.id)) {
        whInv.push({
          id: "whinv-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
          warehouse_id: warehouseId,
          inventory_id: inv.id,
          quantity: 0,
          min_level: inv.min_level,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        added++;
      }
    });

    if (added > 0) {
      this.saveWarehouseInventory(whInv);
    }

    return added;
  }

  // --- Warehouse Transfers ---
  getWarehouseTransfers(): WarehouseTransfer[] {
    return this.getItem<WarehouseTransfer[]>(WAREHOUSE_TRANSFERS_KEY, []);
  }

  saveWarehouseTransfers(list: WarehouseTransfer[]): void {
    this.setItem(WAREHOUSE_TRANSFERS_KEY, list);
  }

  transferInventory(payload: {
    source_warehouse_id: string;
    destination_warehouse_id: string;
    inventory_id: string;
    quantity: number;
    notes?: string;
  }): WarehouseTransfer {
    if (payload.source_warehouse_id === payload.destination_warehouse_id) {
      throw new Error("لا يمكن التحويل لنفس المخزن");
    }
    if (payload.quantity <= 0) {
      throw new Error("الكمية المحولة يجب أن تكون أكبر من صفر");
    }

    const whInv = this.getWarehouseInventory();
    const sourceRow = whInv.find(
      (r) =>
        r.warehouse_id === payload.source_warehouse_id && r.inventory_id === payload.inventory_id,
    );

    const available = sourceRow ? sourceRow.quantity : 0;
    if (available < payload.quantity) {
      const invItem = this.getInventory().find((i) => i.id === payload.inventory_id);
      throw new Error(`عجز في المخزون: المتاح بمخزن المصدر ${available} ${invItem?.unit || ""}`);
    }

    // Deduct source
    sourceRow!.quantity -= payload.quantity;
    sourceRow!.updated_at = new Date().toISOString();

    // Add destination
    let destRow = whInv.find(
      (r) =>
        r.warehouse_id === payload.destination_warehouse_id &&
        r.inventory_id === payload.inventory_id,
    );
    if (destRow) {
      destRow.quantity += payload.quantity;
      destRow.updated_at = new Date().toISOString();
    } else {
      destRow = {
        id: "whinv-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
        warehouse_id: payload.destination_warehouse_id,
        inventory_id: payload.inventory_id,
        quantity: payload.quantity,
        min_level: sourceRow!.min_level || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      whInv.push(destRow);
    }

    this.saveWarehouseInventory(whInv);

    // Sync total summary quantity in inventory list
    const invList = this.getInventory();
    const invItem = invList.find((i) => i.id === payload.inventory_id);
    if (invItem) {
      const totalQty = whInv
        .filter((r) => r.inventory_id === payload.inventory_id)
        .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
      invItem.quantity = totalQty;
      invItem.updated_at = new Date().toISOString();
      this.saveInventory(invList);
    }

    const trfNum =
      "TRF-" +
      new Date().toISOString().slice(0, 10).replace(/-/g, "") +
      "-" +
      Math.random().toString(36).substring(2, 6).toUpperCase();

    const transferObj: WarehouseTransfer = {
      id: "trf-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      transfer_number: trfNum,
      source_warehouse_id: payload.source_warehouse_id,
      destination_warehouse_id: payload.destination_warehouse_id,
      inventory_id: payload.inventory_id,
      quantity: payload.quantity,
      unit: invItem?.unit || "كيلو",
      status: "completed",
      notes: payload.notes || null,
      created_by: "مدير النظام",
      created_at: new Date().toISOString(),
    };

    const transfers = this.getWarehouseTransfers();
    transfers.unshift(transferObj);
    this.saveWarehouseTransfers(transfers);

    // Record transactions
    this.addTransaction({
      inventory_id: payload.inventory_id,
      warehouse_id: payload.source_warehouse_id,
      transfer_id: transferObj.id,
      type: "out",
      quantity: payload.quantity,
      note: `تحويل مخزني صادر برقم ${trfNum}${payload.notes ? ` (${payload.notes})` : ""}`,
    });

    this.addTransaction({
      inventory_id: payload.inventory_id,
      warehouse_id: payload.destination_warehouse_id,
      transfer_id: transferObj.id,
      type: "in",
      quantity: payload.quantity,
      note: `تحويل مخزني وارد برقم ${trfNum}${payload.notes ? ` (${payload.notes})` : ""}`,
    });

    return transferObj;
  }

  // --- Transactions ---
  getTransactions(warehouseId?: string): InventoryTransaction[] {
    let list = this.getItem<InventoryTransaction[]>(TRANSACTIONS_KEY, []);
    if (warehouseId) {
      list = list.filter((t) => t.warehouse_id === warehouseId);
    }
    return list;
  }

  addTransaction(payload: {
    inventory_id: string;
    warehouse_id?: string | null;
    transfer_id?: string | null;
    type: "in" | "out" | "adjustment";
    quantity: number;
    note?: string | null;
  }): InventoryTransaction {
    const list = this.getTransactions();
    const targetWhId = payload.warehouse_id || this.getWarehouses().find((w) => w.is_default)?.id;

    const tx: InventoryTransaction = {
      id: "tx-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      inventory_id: payload.inventory_id,
      warehouse_id: targetWhId,
      transfer_id: payload.transfer_id || null,
      type: payload.type,
      quantity: payload.quantity,
      note: payload.note || null,
      created_at: new Date().toISOString(),
    };

    list.unshift(tx);
    this.setItem(TRANSACTIONS_KEY, list);

    // Apply quantity update to warehouse inventory
    if (targetWhId) {
      const whInv = this.getWarehouseInventory();
      let whRow = whInv.find(
        (r) => r.warehouse_id === targetWhId && r.inventory_id === payload.inventory_id,
      );

      if (!whRow) {
        whRow = {
          id: "whinv-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
          warehouse_id: targetWhId,
          inventory_id: payload.inventory_id,
          quantity: 0,
          min_level: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        whInv.push(whRow);
      }

      if (payload.type === "in") {
        whRow.quantity += payload.quantity;
      } else if (payload.type === "out") {
        whRow.quantity -= payload.quantity;
      } else if (payload.type === "adjustment") {
        whRow.quantity = payload.quantity;
      }
      whRow.updated_at = new Date().toISOString();
      this.saveWarehouseInventory(whInv);

      // Sync summary
      const invList = this.getInventory();
      const invItem = invList.find((i) => i.id === payload.inventory_id);
      if (invItem) {
        invItem.quantity = whInv
          .filter((r) => r.inventory_id === payload.inventory_id)
          .reduce((sum, r) => sum + Number(r.quantity || 0), 0);
        invItem.updated_at = new Date().toISOString();
        this.saveInventory(invList);
      }
    }

    return tx;
  }
}

export const localWarehouseStore = new LocalWarehouseStore();
