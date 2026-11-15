import { OrderStatus, PaymentMethod, OrderType, TableStatus, UserRole } from "../constants";

export { OrderStatus, PaymentMethod, OrderType, TableStatus, UserRole };

export interface Category {
  id: string;
  name_ar: string;
  sort_order: number;
  created_at?: string;
}

export interface QuickOption {
  id: string;
  label_ar: string;
  label_en?: string;
  group?: string;
}

export interface MenuItemAddition {
  id?: string;
  name_ar: string;
  name_en?: string;
  icon?: string;
  price?: number;
  inventory_id?: string | null;
  deduct_qty?: number;
  deduct_unit?: string;
  materialKey?: string;
}

export interface MenuItemIngredient {
  inventory_id: string;
  weight: number;
  unit?: string;
  optional?: boolean;
  waste_percent?: number;
  notes?: string;
}

export interface MenuItem {
  id: string;
  name_ar: string;
  price: number;
  category_id: string;
  image_url: string | null;
  is_available: boolean;
  requires_oven?: boolean;
  ingredients?: MenuItemIngredient[];
  inventory_tracking?: string;
  badge?: string | null;
  additions?: MenuItemAddition[];
  quick_options?: QuickOption[];
  prep_instructions?: string | null;
  allergens?: string[];
  created_at?: string;
}

export interface Table {
  id: string;
  number: number;
  name: string | null;
  status: TableStatus;
}

export interface OrderItem {
  id?: string;
  menu_item_id?: string;
  lineKey?: string;
  name_ar: string;
  name_en?: string;
  price: number;
  quantity: number;
  notes?: string;
  requires_oven?: boolean;
  selectedOptions?: QuickOption[];
  selectedAdditions?: MenuItemAddition[];
}

export interface OrderFeedback {
  id: string;
  order_id: string;
  order_number?: number | null;
  customer_tracking_token?: string | null;
  rating: number;
  comment?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  order_number: number;
  created_at: string;
  updated_at?: string;
  submitted_at?: string | null;
  captain_confirmed_at?: string | null;
  kitchen_started_at?: string | null;
  ready_at?: string | null;
  delivered_at?: string | null;
  is_qr_order?: boolean;
  customer_name?: string | null;
  customer_tracking_token?: string | null;
  inventory_deducted?: boolean;
  status: OrderStatus;
  order_type: OrderType;
  payment_method: PaymentMethod;
  total: number;
  subtotal?: number;
  tax?: number;
  currency?: string;
  pricing_currency?: string;
  payment_currency?: string;
  payment_amount?: number;
  table_id: string | null;
  warehouse_id?: string | null;
  notes: string | null;
  items: OrderItem[];
  feedback?: OrderFeedback | null;
}

export interface CartLine {
  lineKey?: string;
  item: MenuItem;
  quantity: number;
  notes?: string;
  selectedOptions?: QuickOption[];
  selectedAdditions?: MenuItemAddition[];
}

export interface InventoryItem {
  id: string;
  name_ar: string;
  quantity: number;
  unit: string;
  min_level: number;
  cost: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  inventory_id: string;
  warehouse_id?: string | null;
  transfer_id?: string | null;
  quantity: number;
  type: "in" | "out" | "adjustment";
  note: string | null;
  created_at: string;
}

export interface Warehouse {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface WarehouseInventory {
  id: string;
  warehouse_id: string;
  inventory_id: string;
  quantity: number;
  min_level: number;
  created_at: string;
  updated_at: string;
}

export interface WarehouseTransfer {
  id: string;
  transfer_number: string;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  inventory_id: string;
  quantity: number;
  unit: string;
  status: "pending" | "completed" | "cancelled";
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  username?: string | null;
  email?: string | null;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  permissions?: Record<string, any>;
  created_at: string;
  updated_at: string;
}
