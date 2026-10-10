// @ts-nocheck
import { Order, MenuItem, InventoryItem } from "../types";
import { localWarehouseStore } from "../../features/inventory/services/warehouseStore";
import { inventoryService } from "../../features/inventory/services/inventoryService";
import { ORACLE_MIGRATION_ACCOUNTS } from "../data/oracleAccounts";
import { shiftAuditService } from "../../features/shifts/services/shiftAuditService";

export interface Branch {
  id: string;
  name: string;
  name_ar: string;
  code: string;
}

export interface TreasuryContainer {
  id: string;
  name: string;
  currency: string;
  balance?: number;
}

export interface TreasuryAccount {
  id: string;
  account_code?: string;
  containers?: TreasuryContainer[];
  linked_to_restaurant?: boolean;
  branch_id: string;
  name_ar: string;
  type: "cash" | "bank";
  currency: string;
  balance: number;
  is_open: boolean;
  opening_balance: number;
  available_balance?: number;
  responsible_employee?: string;
  status?: "active" | "inactive" | "closed";
  deleted?: boolean;
}

export interface Supplier {
  id: string;
  name_ar: string;
  phone?: string;
  balance: number; // supplier ledger balance
  account_code?: string; // Linked Chart of Accounts code (e.g. 24010100)
  currency?: string;
  deleted?: boolean;
}

export interface InventorySettings {
  allowNegativeStock: boolean;
  defaultUnit: string;
}

export interface ExtendedInventoryItem {
  id: string;
  item_code: string;
  barcode: string;
  name_en: string;
  category: string;
  preferred_supplier_id?: string;
  average_cost: number;
  last_purchase_price: number;
  status: "active" | "inactive";
  max_level?: number;
  storage_location?: string;
  notes?: string;
}

export interface MenuItemQualitySpecs {
  menu_item_id: string;
  shelf_life_hours: number;
  storage_condition: "chilled_4c" | "frozen_18c" | "hot_hold_60c" | "room_temp";
  storage_condition_label?: string;
  prep_instructions?: string;
  allergens?: string[];
  quality_checklist?: string[];
  max_display_hours?: number;
}

export interface InventoryDocumentItem {
  inventory_id: string;
  quantity: number;
  unit_cost: number;
  counted_quantity?: number;
  difference?: number;
}

export interface InventoryDocument {
  id: string;
  doc_number: string;
  type:
    | "goods_receipt"
    | "goods_issue"
    | "stock_transfer"
    | "stock_adjustment"
    | "inventory_count"
    | "opening_balance";
  date: string;
  branch_id: string;
  to_branch_id?: string;
  supplier_id?: string;
  items: InventoryDocumentItem[];
  notes?: string;
  status: "draft" | "approved" | "cancelled";
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  branch_id: string;
  supplier_id: string;
  order_date: string;
  status: "draft" | "sent" | "received" | "returned" | "cancelled";
  items: {
    inventory_id: string;
    quantity: number;
    unit_cost: number;
    received_quantity?: number;
    returned_quantity?: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  currency?: "USD" | "SSP" | string;
  exchange_rate?: number;
  total_base_usd?: number;
  notes?: string;
  received_date?: string;
}

export interface TreasuryTransaction {
  id: string;
  branch_id: string;
  treasury_id: string;
  type:
    | "deposit"
    | "withdrawal"
    | "transfer_in"
    | "transfer_out"
    | "sales"
    | "purchase"
    | "expense"
    | "reconciliation";
  amount: number;
  currency: string;
  related_entity_id?: string; // Order ID, Purchase ID, Voucher ID
  payment_method?: string; // cash | card | wallet
  note: string;
  created_at: string;
}

export interface Voucher {
  id: string;
  branch_id: string;
  type: "receipt" | "payment" | "transfer";
  category: string; // e.g., Rent, Salaries, Electricity, Water
  amount: number;
  currency: string;
  payment_method: string;
  treasury_id: string;
  description: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  cost_center?: string;
  attachment?: string;
  deleted?: boolean;
}

export interface Account {
  code: string;
  name_ar: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  balance: number;
  parent_code?: string;
  level: number;
  status: "active" | "inactive";
  initial_balance?: number;
  system_binding?:
    | "none"
    | "treasury_main"
    | "treasury_cib"
    | "treasury_extra"
    | "treasury_usd"
    | "suppliers_payable"
    | "sales_revenue"
    | "operating_expenses"
    | "warehouse_main_value"
    | "warehouse_kitchen_value"
    | "expired_inventory_value"
    | "disposed_waste_value"
    | string;
  currency?: string;
  sync_status?: "pending" | "synced";
}

export interface JournalLine {
  account_code: string;
  debit: number;
  credit: number;
  currency?: string;
  rate?: number;
  cost_center?: string;
  description?: string;
  id?: string;
}

export interface JournalEntry {
  id: string;
  branch_id: string;
  date: string;
  description: string;
  lines: JournalLine[];
  created_at: string;
  reference?: string;
  currency: string;
  created_by: string;
  is_approved: boolean;
  sequence?: number;
  attachments?: string[];
}

export interface AuditLog {
  id: string;
  user_email: string;
  action: string;
  details: string;
  created_at: string;
  before_value?: string;
  after_value?: string;
  ip_address?: string;
  action_type: "CREATE" | "UPDATE" | "DELETE" | "TRANSACTION" | "SYSTEM";
}

export interface TreasuryReconciliation {
  id: string;
  treasury_id: string;
  date: string;
  ledger_balance: number;
  actual_balance: number;
  difference: number;
  reconciled_by: string;
  notes: string;
}

export interface SystemUser {
  id: string;
  full_name: string;
  username: string; // Used for login (email or plain text)
  phone: string;
  role: string;
  password?: string;
  permissions?: UserPermission;
  created_at: string;
}

export interface UserPermission {
  // Legacy / top-level permissions
  orders?: boolean;
  pos?: boolean;
  captain?: boolean;
  kitchen?: boolean;
  delivery?: boolean;
  inventory?: boolean;
  hr?: boolean;
  purchasing?: boolean;
  production?: boolean;
  treasury?: boolean;
  accounting?: boolean;
  journal_approval?: boolean;
  expense_approval?: boolean;
  revenue_approval?: boolean;
  reports?: boolean;
  cost_centers?: boolean;
  branch_mgmt?: boolean;
  audit_logs?: boolean;
  users_roles?: boolean;

  // Granular Sub-permissions & Super Admin Controls
  // 1. Orders & Sales
  orders_view?: boolean;
  orders_create_custom?: boolean;
  orders_cancel_modify?: boolean;
  orders_manage_carts?: boolean;
  orders_generate_qr?: boolean;

  // 2. POS
  pos_access?: boolean;
  pos_create_custom_order?: boolean;
  pos_apply_discounts?: boolean;
  pos_void_items?: boolean;

  // 3. Captain Order
  captain_access?: boolean;
  captain_create_order?: boolean;
  captain_transfer_tables?: boolean;
  captain_modify_items?: boolean;

  // 4. Kitchen / KDS & Oven
  kitchen_view?: boolean;
  kitchen_change_status?: boolean;
  kitchen_modify_order?: boolean;

  // 5. Delivery
  delivery_view?: boolean;
  delivery_update_status?: boolean;

  // 6. Inventory
  inventory_view?: boolean;
  inventory_adjust_transfer?: boolean;
  inventory_waste_dispose?: boolean;

  // 7. Purchasing
  purchasing_view?: boolean;
  purchasing_add_invoice?: boolean;
  purchasing_returns?: boolean;

  // 8. Production
  production_view?: boolean;
  production_execute?: boolean;

  // 9. HR
  hr_view_attendance?: boolean;
  hr_manage_payroll_loans?: boolean;

  // 10. Treasury
  treasury_view?: boolean;
  treasury_open_close?: boolean;
  treasury_transfer_reconcile?: boolean;

  // 11. Accounting & General Ledger
  accounting_view?: boolean;
  accounting_post_journal?: boolean;
  accounting_lock_period?: boolean;

  // 12. Approvals
  approval_journals?: boolean;
  approval_expenses?: boolean;
  approval_revenues?: boolean;

  // 13. Mall & Garden
  mall_manage_shops?: boolean;
  mall_garden_finance?: boolean;

  // 14. Reports
  reports_view_sales?: boolean;
  reports_view_financials?: boolean;

  // 15. Super Admin & System
  super_admin_full_access?: boolean;
  system_manage_users?: boolean;
  system_backup_update?: boolean;
  system_audit_logs?: boolean;

  // Park & Tickets (Mall)
  manage_park_shifts?: boolean;
  delete_park_shifts?: boolean;
  park_reports?: boolean;
}

export interface Employee {
  id: string;
  name: string;
  job_title: string;
  department: string;
  phone: string;
  email?: string;
  hire_date: string;
  salary: number;
  currency: string;
  status: "active" | "inactive" | "suspended";
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  status: "present" | "absent" | "leave" | "late";
  check_in?: string;
  check_out?: string;
  notes?: string;
}

export interface EmployeeLoan {
  id: string;
  employee_id: string;
  amount: number;
  date: string;
  currency: string;
  repayment_months: number;
  paid_amount: number;
  status: "active" | "paid";
  notes?: string;
}

export interface PayrollRecord {
  id: string;
  employee_id: string;
  month: string;
  basic_salary: number;
  currency: string;
  bonuses: number;
  deductions: number;
  loan_deduction: number;
  net_salary: number;
  payment_date?: string;
  payment_treasury_id?: string;
  status: "draft" | "paid";
  notes?: string;
}

export const DEFAULT_EMPLOYEES: Employee[] = [
  {
    id: "emp-1",
    name: "وليد أحمد محمد دويك",
    job_title: "رئيس الطهاة (Chef)",
    department: "المطبخ",
    phone: "01023456789",
    hire_date: "2024-01-15",
    salary: 8000,
    currency: "EGP",
    status: "active",
  },
  {
    id: "emp-2",
    name: "هشام نور",
    job_title: "مدير التشغيل العام",
    department: "الإدارة",
    phone: "01124578963",
    hire_date: "2023-05-10",
    salary: 15000,
    currency: "EGP",
    status: "active",
  },
  {
    id: "emp-3",
    name: "جمال عطا الله",
    job_title: "المحاسب المالي",
    department: "الإدارة",
    phone: "01235689741",
    hire_date: "2024-03-01",
    salary: 12000,
    currency: "EGP",
    status: "active",
  },
  {
    id: "emp-4",
    name: "محمد شريف",
    job_title: "كاشير الصالة",
    department: "الصالة والتوصيل",
    phone: "01547896321",
    hire_date: "2024-06-15",
    salary: 7000,
    currency: "EGP",
    status: "active",
  },
  {
    id: "emp-5",
    name: "أحمد حسام",
    job_title: "مشرف الفروع",
    department: "الإدارة",
    phone: "01098765432",
    hire_date: "2023-11-01",
    salary: 10000,
    currency: "EGP",
    status: "active",
  },
];

export interface MallShop {
  id: string;
  shop_number: string;
  name_ar: string;
  account_number: string;
  tenant_name: string;
  phone: string;
  monthly_rent: number;
  status: "rented" | "vacant" | "maintenance";
  space_sqm?: number;
  notes?: string;
  contract?: {
    start_date: string;
    end_date: string;
    deposit_amount: number;
    advance_payment?: number;
    nationality?: string;
    id_number?: string;
    terms?: string;
    contract_image?: string;
    id_image?: string;
    language: "ar" | "en";
    created_at: string;
    authorized_representative?: string;
    tenant_address?: string;
    floor?: string;
    area?: string;
    lease_term?: string;
    renewal_option?: string;
    currency?: string;
    payment_due_date?: string;
    payment_method?: string;
    service_charge?: number;
    electricity_included?: boolean;
    water_included?: boolean;
    other_charges?: string;
    annual_escalation?: string;
    fit_out_period?: string;
    custom_shop_name?: string;
    custom_activity?: string;
  };
}

export interface TerminatedContractRecord {
  id: string;
  shop_id: string;
  shop_number: string;
  shop_name: string;
  tenant_name: string;
  phone: string;
  monthly_rent: number;
  deposit_amount: number;
  refund_amount: number;
  start_date: string;
  end_date: string;
  termination_date: string;
  contract_image?: string;
  termination_image: string;
  notes?: string;
}

export interface MallRentalPayment {
  id: string;
  shop_id: string;
  year: number;
  month: number;
  amount_due: number;
  amount_paid: number;
  status: "paid" | "partial" | "unpaid";
  payment_date?: string;
  payment_method?: string;
  receipt_number?: string;
  notes?: string;
}

export interface MallGardenRevenue {
  id: string;
  year: number;
  month: number;
  category: "garden_ticket" | "garden_event" | "parking" | "other";
  description: string;
  amount: number;
  date: string;
  receipt_number?: string;
  notes?: string;
}

export interface MallGardenExpense {
  id: string;
  year: number;
  month: number;
  category: "maintenance" | "electricity" | "water" | "security" | "cleaning" | "salary" | "other";
  title: string;
  amount: number;
  date: string;
  paid_to?: string;
  notes?: string;
}

export interface ParkTicketItem {
  id: string;
  name_ar: string;
  name_en?: string;
  type: "single_regular" | "family_regular" | "single_holiday" | "family_holiday" | "custom";
  price_usd: number;
  persons_count?: number;
  is_active: boolean;
}

export interface ParkCustomer {
  id: string;
  name_ar: string;
  phone?: string;
  company?: string;
  account_code?: string;
  notes?: string;
}

export interface ParkOperationalTreasury {
  id: string;
  name_ar: string;
  payment_method: "cash" | "visa" | "bank_transfer" | "credit";
  currency: "USD" | "SSP";
  linked_real_treasury_id: string;
  balance: number;
}

export interface ParkTicketCartItem {
  ticket_id: string;
  name_ar: string;
  price_usd: number;
  quantity: number;
  note?: string;
}

export interface ParkTicketTransaction {
  id: string;
  tx_number: string;
  manual_tx_number?: string;
  shift_id: string;
  shift_number: string;
  items: ParkTicketCartItem[];
  subtotal_usd: number;
  total_usd: number;
  currency: "USD" | "SSP";
  exchange_rate: number;
  total_paid_in_currency: number;
  payment_method: "cash" | "visa" | "bank_transfer" | "credit";
  reference_number?: string;
  customer_id?: string;
  customer_name?: string;
  operational_treasury_id: string;
  linked_real_treasury_id: string;
  status: "completed" | "refunded";
  refund_reason?: string;
  refund_tx_id?: string;
  refund_journal_ref?: string;
  refund_at?: string;
  transaction_date: string;
  transaction_time: string;
  system_timestamp: string;
  journal_entry_ref?: string;
  created_by?: string;
  notes?: string;
}

export interface ParkShift {
  id: string;
  shift_number: string;
  auto_shift_number?: string;
  start_at: string;
  end_at?: string;
  status: "open" | "closed";
  cashier_name: string;
  operational_treasury_balances_at_close?: Record<string, number>;
  destination_transfers?: Array<{
    op_treasury_id: string;
    op_treasury_name: string;
    real_treasury_id: string;
    real_treasury_name: string;
    currency: "USD" | "SSP";
    amount: number;
    journal_ref?: string;
  }>;
  generated_journal_refs?: string[];
  notes?: string;
  total_revenue_usd?: number;
  total_transactions_count?: number;
}

export interface RestaurantShift {
  id: string;
  shift_number: string;
  auto_shift_number?: string;
  start_at: string;
  end_at?: string;
  status: "open" | "closed";
  cashier_name: string;
  cashier_id?: string;
  cashier_type?: "hr" | "manual";
  opening_balance?: number;
  opening_notes?: string;
  closing_notes?: string;
  total_sales?: number;
  total_tax?: number;
  total_discount?: number;
  total_service_fee?: number;
  total_delivery_fee?: number;
  total_refunds?: number;
  net_total?: number;
  orders_count?: number;
  refunds_count?: number;
  payment_breakdown?: {
    cash?: number;
    card?: number;
    wallet?: number;
  };
  generated_journal_refs?: string[];
  notes?: string;
}

export interface RestaurantRefundRecord {
  id: string;
  order_number: number;
  shift_id: string;
  shift_number: string;
  refund_amount: number;
  refund_reason: string;
  created_at: string;
  journal_ref?: string;
  cashier_name: string;
  payment_method: "cash" | "card" | "wallet";
  currency: string;
  items_summary?: string;
}

export const DEFAULT_PARK_TICKET_ITEMS: ParkTicketItem[] = [
  {
    id: "park-tkt-1",
    name_ar: "تذكرة دخول فردية - أيام عادية",
    name_en: "Single Entrance Ticket – Regular Days",
    type: "single_regular",
    price_usd: 5,
    persons_count: 1,
    is_active: true,
  },
  {
    id: "park-tkt-2",
    name_ar: "تذكرة دخول عائلية - أيام عادية - 5 أفراد",
    name_en: "Family Entrance Ticket – Regular Days – 5 Persons",
    type: "family_regular",
    price_usd: 20,
    persons_count: 5,
    is_active: true,
  },
  {
    id: "park-tkt-3",
    name_ar: "تذكرة دخول فردية - عطلات وأعياد",
    name_en: "Single Entrance Ticket – Holidays",
    type: "single_holiday",
    price_usd: 10,
    persons_count: 1,
    is_active: true,
  },
  {
    id: "park-tkt-4",
    name_ar: "تذكرة دخول عائلية - عطلات وأعياد - 5 أفراد",
    name_en: "Family Entrance Ticket – Holidays – 5 Persons",
    type: "family_holiday",
    price_usd: 35,
    persons_count: 5,
    is_active: true,
  },
];

export const DEFAULT_PARK_CUSTOMERS: ParkCustomer[] = [
  { id: "cust-park-1", name_ar: "عميل نقدي عام", phone: "-", company: "-" },
  {
    id: "cust-park-2",
    name_ar: "شركة الرحلات السياحية",
    phone: "0912345678",
    company: "السياحة الدولية",
  },
  {
    id: "cust-park-3",
    name_ar: "مدرسة الأمل النموذجية",
    phone: "0987654321",
    company: "وزارة التربية",
  },
  {
    id: "cust-park-4",
    name_ar: "نقابة المهندسين",
    phone: "0911223344",
    company: "النقابات المهنية",
  },
];

export const DEFAULT_PARK_OPERATIONAL_TREASURIES: ParkOperationalTreasury[] = [
  {
    id: "opt-cash-usd",
    name_ar: "Park Tickets - Cash USD",
    payment_method: "cash",
    currency: "USD",
    linked_real_treasury_id: "tr-1",
    balance: 0,
  },
  {
    id: "opt-visa-usd",
    name_ar: "Park Tickets - Visa USD",
    payment_method: "visa",
    currency: "USD",
    linked_real_treasury_id: "tr-1",
    balance: 0,
  },
  {
    id: "opt-transfer-usd",
    name_ar: "Park Tickets - Transfer USD",
    payment_method: "bank_transfer",
    currency: "USD",
    linked_real_treasury_id: "tr-1",
    balance: 0,
  },
  {
    id: "opt-credit-usd",
    name_ar: "Park Tickets - Credit USD",
    payment_method: "credit",
    currency: "USD",
    linked_real_treasury_id: "tr-1",
    balance: 0,
  },
  {
    id: "opt-cash-ssp",
    name_ar: "Park Tickets - Cash SSP",
    payment_method: "cash",
    currency: "SSP",
    linked_real_treasury_id: "tr-1",
    balance: 0,
  },
  {
    id: "opt-visa-ssp",
    name_ar: "Park Tickets - Visa SSP",
    payment_method: "visa",
    currency: "SSP",
    linked_real_treasury_id: "tr-1",
    balance: 0,
  },
  {
    id: "opt-transfer-ssp",
    name_ar: "Park Tickets - Transfer SSP",
    payment_method: "bank_transfer",
    currency: "SSP",
    linked_real_treasury_id: "tr-1",
    balance: 0,
  },
  {
    id: "opt-credit-ssp",
    name_ar: "Park Tickets - Credit SSP",
    payment_method: "credit",
    currency: "SSP",
    linked_real_treasury_id: "tr-1",
    balance: 0,
  },
];

const DEFAULT_GARDEN_REVENUES: MallGardenRevenue[] = [
  {
    id: "rev-1",
    year: 2026,
    month: 1,
    category: "garden_ticket",
    description: "تذاكر دخول الحديقة - يناير",
    amount: 4500,
    date: "2026-01-31",
    receipt_number: "REC-G-101",
  },
  {
    id: "rev-2",
    year: 2026,
    month: 2,
    category: "garden_ticket",
    description: "تذاكر دخول الحديقة - فبراير",
    amount: 5200,
    date: "2026-02-28",
    receipt_number: "REC-G-102",
  },
  {
    id: "rev-3",
    year: 2026,
    month: 3,
    category: "garden_event",
    description: "حفل عائلي وتأجير مساحة بالحديقة",
    amount: 8000,
    date: "2026-03-15",
    receipt_number: "REC-G-103",
  },
];

const DEFAULT_GARDEN_EXPENSES: MallGardenExpense[] = [
  {
    id: "exp-1",
    year: 2026,
    month: 1,
    category: "maintenance",
    title: "صيانة إنارة الحديقة والممرات",
    amount: 1200,
    date: "2026-01-10",
    paid_to: "شركة الصيانة الحديثة",
  },
  {
    id: "exp-2",
    year: 2026,
    month: 1,
    category: "electricity",
    title: "فاتورة كهرباء المول والحديقة",
    amount: 2500,
    date: "2026-01-15",
    paid_to: "شركة الكهرباء",
  },
  {
    id: "exp-3",
    year: 2026,
    month: 2,
    category: "cleaning",
    title: "أدوات ومواد تنظيف المول",
    amount: 800,
    date: "2026-02-05",
    paid_to: "توريدات النظافة",
  },
  {
    id: "exp-4",
    year: 2026,
    month: 2,
    category: "security",
    title: "رواتب أمن وحراسة المول",
    amount: 3500,
    date: "2026-02-28",
    paid_to: "فريق الأمن",
  },
];

const DEFAULT_MALL_SHOPS: MallShop[] = [
  {
    id: "shop-d1",
    shop_number: "D1",
    name_ar: "ملابس أطفال M/Akok atak akol",
    account_number: "14030102",
    tenant_name: "M/Akok atak akol",
    phone: "-",
    monthly_rent: 800,
    status: "rented",
    space_sqm: 40,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d2",
    shop_number: "D2",
    name_ar: "صيدلية Abdalla Majok",
    account_number: "14030111",
    tenant_name: "Abdalla Majok",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 45,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d3",
    shop_number: "D3",
    name_ar: "Mr / Thabo patrick Macagala",
    account_number: "14030124",
    tenant_name: "Thabo patrick",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 35,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d4",
    shop_number: "D4",
    name_ar: "عطور Achail mabok lang",
    account_number: "14030122",
    tenant_name: "Achail mabok lang",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 30,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d5",
    shop_number: "D5",
    name_ar: "عطور Achail mabok lang (نفس العميل)",
    account_number: "14030122",
    tenant_name: "Achail mabok lang",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 30,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d6",
    shop_number: "D6",
    name_ar: "عطور Achail mabok lang",
    account_number: "14030142",
    tenant_name: "Achail mabok lang",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 35,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d7",
    shop_number: "D7",
    name_ar: "ملابس أطفال Niting marin abwak",
    account_number: "14030152",
    tenant_name: "Niting marin",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 40,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d8",
    shop_number: "D8",
    name_ar: "عطور Mrs / Sara enoch machiex",
    account_number: "14030162",
    tenant_name: "Sara enoch",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 30,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d9",
    shop_number: "D9",
    name_ar: "عطور Mrs / Sara enoch machiex",
    account_number: "14030171",
    tenant_name: "Sara enoch",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 30,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d10",
    shop_number: "D10",
    name_ar: "وكالة طبية M/Erik danial dot",
    account_number: "14030192",
    tenant_name: "Erik danial",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 50,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d11",
    shop_number: "D11",
    name_ar: "konoro enterprises co",
    account_number: "14030411",
    tenant_name: "konoro enterprises",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 60,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d12",
    shop_number: "D12",
    name_ar: "مخزن الشركة",
    account_number: "14030201",
    tenant_name: "مخزن الشركة",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 80,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d13",
    shop_number: "D13",
    name_ar: "استيراد وتصدير Wanloi Ktl Invesment",
    account_number: "14030198",
    tenant_name: "Wanloi Ktl Invesment",
    phone: "-",
    monthly_rent: 700,
    status: "rented",
    space_sqm: 55,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d14",
    shop_number: "D14",
    name_ar: "مغسلة Mrs / Aluel Deng Awoul",
    account_number: "14030230",
    tenant_name: "Aluel Deng Awoul",
    phone: "-",
    monthly_rent: 500,
    status: "rented",
    space_sqm: 50,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d15",
    shop_number: "D15",
    name_ar: "مغسلة Mrs / Aluel Deng Awoul (نفس العميل)",
    account_number: "14030230",
    tenant_name: "Aluel Deng Awoul",
    phone: "-",
    monthly_rent: 500,
    status: "rented",
    space_sqm: 50,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d16",
    shop_number: "D16",
    name_ar: "مغسلة Mrs / Aluel Deng Awoul (نفس العميل)",
    account_number: "14030230",
    tenant_name: "Aluel Deng Awoul",
    phone: "-",
    monthly_rent: 500,
    status: "rented",
    space_sqm: 50,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d17",
    shop_number: "D17",
    name_ar: "شركة سياحه M/S Awar athuai akok (سيميا)",
    account_number: "14030240",
    tenant_name: "M/S Awar athuai",
    phone: "-",
    monthly_rent: 600,
    status: "rented",
    space_sqm: 65,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d18",
    shop_number: "D18",
    name_ar: "Hafza Cur Deng",
    account_number: "14030250",
    tenant_name: "Hafza Cur Deng",
    phone: "-",
    monthly_rent: 900,
    status: "rented",
    space_sqm: 70,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d19",
    shop_number: "D19",
    name_ar: "نظارات Mr / Harish Koudula",
    account_number: "14030300",
    tenant_name: "Harish Koudula",
    phone: "-",
    monthly_rent: 500,
    status: "rented",
    space_sqm: 40,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d20",
    shop_number: "D20",
    name_ar: "نظارات Mr / Harish Koudula (نفس العميل)",
    account_number: "14030300",
    tenant_name: "Harish Koudula",
    phone: "-",
    monthly_rent: 500,
    status: "rented",
    space_sqm: 40,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d21",
    shop_number: "D21",
    name_ar: "مكتبة internet International Trade",
    account_number: "14030320",
    tenant_name: "internet International Trade",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 45,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d30",
    shop_number: "D30",
    name_ar: "شركة سياحه easy travel and tours ltd",
    account_number: "14030432",
    tenant_name: "easy travel",
    phone: "-",
    monthly_rent: 550,
    status: "rented",
    space_sqm: 50,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d31",
    shop_number: "D31",
    name_ar: "شركة سياحه easy travel and tours ltd",
    account_number: "14030442",
    tenant_name: "easy travel",
    phone: "-",
    monthly_rent: 550,
    status: "rented",
    space_sqm: 50,
    notes: "سنتر بوب",
  },
  {
    id: "shop-d32",
    shop_number: "D32",
    name_ar: "John Juma Peter Alphonse",
    account_number: "14030451",
    tenant_name: "John Juma Peter",
    phone: "-",
    monthly_rent: 550,
    status: "rented",
    space_sqm: 50,
    notes: "سنتر بوب",
  },
  {
    id: "shop-b1",
    shop_number: "B1",
    name_ar: "مطعم Maged Gorg Ado",
    account_number: "14010651",
    tenant_name: "Maged Gorg Ado",
    phone: "-",
    monthly_rent: 0,
    status: "rented",
    space_sqm: 120,
    notes: "المول",
  },
  {
    id: "shop-b2",
    shop_number: "B2",
    name_ar: "lilico engineering service",
    account_number: "25030200",
    tenant_name: "lilico engineering",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 60,
    notes: "المول",
  },
  {
    id: "shop-b3",
    shop_number: "B3",
    name_ar: "lilico engineering service",
    account_number: "14010470",
    tenant_name: "lilico engineering",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 60,
    notes: "المول",
  },
  {
    id: "shop-b4",
    shop_number: "B4",
    name_ar: "بنك ايدين",
    account_number: "25030110",
    tenant_name: "بنك ايدين",
    phone: "-",
    monthly_rent: 1200,
    status: "rented",
    space_sqm: 150,
    notes: "المول",
  },
  {
    id: "shop-b5",
    shop_number: "B5",
    name_ar: "بنك ايدين",
    account_number: "25030110",
    tenant_name: "بنك ايدين",
    phone: "-",
    monthly_rent: 1200,
    status: "rented",
    space_sqm: 150,
    notes: "المول",
  },
  {
    id: "shop-b6",
    shop_number: "B6",
    name_ar: "وحدة تجارية B6",
    account_number: "14010450-B6",
    tenant_name: "-",
    phone: "-",
    monthly_rent: 750,
    status: "vacant",
    space_sqm: 65,
    notes: "المول",
  },
  {
    id: "shop-b7",
    shop_number: "B7",
    name_ar: "مطعم Aluel Deng Awoul",
    account_number: "14010450",
    tenant_name: "Aluel Deng Awoul",
    phone: "-",
    monthly_rent: 750,
    status: "rented",
    space_sqm: 90,
    notes: "المول",
  },
  {
    id: "shop-b8",
    shop_number: "B8",
    name_ar: "مطعم Aluel Deng Awoul (نفس العميل)",
    account_number: "14010450",
    tenant_name: "Aluel Deng Awoul",
    phone: "-",
    monthly_rent: 750,
    status: "rented",
    space_sqm: 90,
    notes: "المول",
  },
  {
    id: "shop-b9",
    shop_number: "B9",
    name_ar: "مطعم Aluel Deng Awoul (نفس العميل)",
    account_number: "14010450",
    tenant_name: "Aluel Deng Awoul",
    phone: "-",
    monthly_rent: 750,
    status: "rented",
    space_sqm: 90,
    notes: "المول",
  },
  {
    id: "shop-b10",
    shop_number: "B10",
    name_ar: "مطعم Aluel Deng Awoul (نفس العميل)",
    account_number: "14010450",
    tenant_name: "Aluel Deng Awoul",
    phone: "-",
    monthly_rent: 750,
    status: "rented",
    space_sqm: 90,
    notes: "المول",
  },
  {
    id: "shop-g2",
    shop_number: "G2",
    name_ar: "تصوير وطباعة image world",
    account_number: "14010280",
    tenant_name: "image world",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 40,
    notes: "المول",
  },
  {
    id: "shop-g3",
    shop_number: "G3",
    name_ar: "شركة سياحه Steven + sara Nile travel",
    account_number: "14010140",
    tenant_name: "Steven + sara",
    phone: "-",
    monthly_rent: 550,
    status: "rented",
    space_sqm: 50,
    notes: "المول",
  },
  {
    id: "shop-g4",
    shop_number: "G4",
    name_ar: "شركة سياحه Steven + sara Nile travel",
    account_number: "14010140",
    tenant_name: "Steven + sara",
    phone: "-",
    monthly_rent: 500,
    status: "rented",
    space_sqm: 50,
    notes: "المول",
  },
  {
    id: "shop-g5",
    shop_number: "G5",
    name_ar: "اتليه teraza daniel lado",
    account_number: "14010313",
    tenant_name: "teraza daniel lado",
    phone: "-",
    monthly_rent: 500,
    status: "rented",
    space_sqm: 45,
    notes: "المول",
  },
  {
    id: "shop-g6",
    shop_number: "G6",
    name_ar: "كوافير حريمي Wiaamramadan",
    account_number: "14010316",
    tenant_name: "Wiaamramadan",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 50,
    notes: "المول",
  },
  {
    id: "shop-g7",
    shop_number: "G7",
    name_ar: "كوافير رجالي Wiaamramadan",
    account_number: "14010316",
    tenant_name: "Wiaamramadan",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 50,
    notes: "المول",
  },
  {
    id: "shop-g8",
    shop_number: "G8",
    name_ar: "eagle enterprise",
    account_number: "14010330",
    tenant_name: "eagle enterprise",
    phone: "-",
    monthly_rent: 0,
    status: "vacant",
    space_sqm: 55,
    notes: "المول",
  },
  {
    id: "shop-g9",
    shop_number: "G9",
    name_ar: "سوبر ماركت Market china",
    account_number: "14010340",
    tenant_name: "Market china",
    phone: "-",
    monthly_rent: 625,
    status: "rented",
    space_sqm: 140,
    notes: "المول",
  },
];

const DEFAULT_MALL_PAYMENTS: MallRentalPayment[] = [
  {
    id: "pay-d1-2",
    shop_id: "shop-d1",
    year: 2026,
    month: 2,
    amount_due: 800,
    amount_paid: 800,
    status: "paid",
    payment_date: "2026-02-10",
    payment_method: "cash",
    receipt_number: "REC-2001",
  },
  {
    id: "pay-d13-2",
    shop_id: "shop-d13",
    year: 2026,
    month: 2,
    amount_due: 700,
    amount_paid: 800,
    status: "paid",
    payment_date: "2026-02-12",
    payment_method: "bank_transfer",
    receipt_number: "REC-2002",
  },
  {
    id: "pay-d14-4",
    shop_id: "shop-d14",
    year: 2026,
    month: 4,
    amount_due: 500,
    amount_paid: 1500,
    status: "paid",
    payment_date: "2026-04-10",
    payment_method: "cash",
    receipt_number: "REC-2003",
  },
  {
    id: "pay-d17-1",
    shop_id: "shop-d17",
    year: 2026,
    month: 1,
    amount_due: 600,
    amount_paid: 600,
    status: "paid",
    payment_date: "2026-01-05",
    payment_method: "cash",
    receipt_number: "REC-2004",
  },
  {
    id: "pay-d17-2",
    shop_id: "shop-d17",
    year: 2026,
    month: 2,
    amount_due: 600,
    amount_paid: 600,
    status: "paid",
    payment_date: "2026-02-05",
    payment_method: "cash",
    receipt_number: "REC-2005",
  },
  {
    id: "pay-d17-6",
    shop_id: "shop-d17",
    year: 2026,
    month: 6,
    amount_due: 600,
    amount_paid: 600,
    status: "paid",
    payment_date: "2026-06-05",
    payment_method: "cash",
    receipt_number: "REC-2006",
  },
  {
    id: "pay-d17-7",
    shop_id: "shop-d17",
    year: 2026,
    month: 7,
    amount_due: 600,
    amount_paid: 600,
    status: "paid",
    payment_date: "2026-07-05",
    payment_method: "cash",
    receipt_number: "REC-2007",
  },
  {
    id: "pay-d18-5",
    shop_id: "shop-d18",
    year: 2026,
    month: 5,
    amount_due: 900,
    amount_paid: 9600,
    status: "paid",
    payment_date: "2026-05-10",
    payment_method: "bank_transfer",
    receipt_number: "REC-2008",
  },
  {
    id: "pay-d19-3",
    shop_id: "shop-d19",
    year: 2026,
    month: 3,
    amount_due: 500,
    amount_paid: 2000,
    status: "paid",
    payment_date: "2026-03-10",
    payment_method: "cash",
    receipt_number: "REC-2009",
  },
  {
    id: "pay-d19-5",
    shop_id: "shop-d19",
    year: 2026,
    month: 5,
    amount_due: 500,
    amount_paid: 1000,
    status: "paid",
    payment_date: "2026-05-10",
    payment_method: "cash",
    receipt_number: "REC-2010",
  },
  {
    id: "pay-d21-3",
    shop_id: "shop-d21",
    year: 2026,
    month: 3,
    amount_due: 0,
    amount_paid: 3000,
    status: "paid",
    payment_date: "2026-03-15",
    payment_method: "cash",
    receipt_number: "REC-2011",
  },
  {
    id: "pay-d30-7",
    shop_id: "shop-d30",
    year: 2026,
    month: 7,
    amount_due: 550,
    amount_paid: 3300,
    status: "paid",
    payment_date: "2026-07-10",
    payment_method: "bank_transfer",
    receipt_number: "REC-2012",
  },
  {
    id: "pay-d32-2",
    shop_id: "shop-d32",
    year: 2026,
    month: 2,
    amount_due: 550,
    amount_paid: 3300,
    status: "paid",
    payment_date: "2026-02-15",
    payment_method: "bank_transfer",
    receipt_number: "REC-2013",
  },
  {
    id: "pay-b1-6",
    shop_id: "shop-b1",
    year: 2026,
    month: 6,
    amount_due: 0,
    amount_paid: 5000,
    status: "paid",
    payment_date: "2026-06-10",
    payment_method: "cash",
    receipt_number: "REC-2014",
  },
  {
    id: "pay-b7-1",
    shop_id: "shop-b7",
    year: 2026,
    month: 1,
    amount_due: 750,
    amount_paid: 4500,
    status: "paid",
    payment_date: "2026-01-10",
    payment_method: "cash",
    receipt_number: "REC-2015",
  },
  {
    id: "pay-b7-3",
    shop_id: "shop-b7",
    year: 2026,
    month: 3,
    amount_due: 750,
    amount_paid: 3000,
    status: "paid",
    payment_date: "2026-03-10",
    payment_method: "cash",
    receipt_number: "REC-2016",
  },
  {
    id: "pay-b7-4",
    shop_id: "shop-b7",
    year: 2026,
    month: 4,
    amount_due: 750,
    amount_paid: 6500,
    status: "paid",
    payment_date: "2026-04-10",
    payment_method: "cash",
    receipt_number: "REC-2017",
  },
  {
    id: "pay-b7-5",
    shop_id: "shop-b7",
    year: 2026,
    month: 5,
    amount_due: 750,
    amount_paid: -1500,
    status: "partial",
    payment_date: "2026-05-10",
    payment_method: "cash",
    receipt_number: "REC-2018",
    notes: "تسوية",
  },
  {
    id: "pay-g9-1",
    shop_id: "shop-g9",
    year: 2026,
    month: 1,
    amount_due: 625,
    amount_paid: 5000,
    status: "paid",
    payment_date: "2026-01-05",
    payment_method: "bank_transfer",
    receipt_number: "REC-2019",
  },
  {
    id: "pay-g9-2",
    shop_id: "shop-g9",
    year: 2026,
    month: 2,
    amount_due: 625,
    amount_paid: 5000,
    status: "paid",
    payment_date: "2026-02-05",
    payment_method: "bank_transfer",
    receipt_number: "REC-2020",
  },
  {
    id: "pay-g9-3",
    shop_id: "shop-g9",
    year: 2026,
    month: 3,
    amount_due: 625,
    amount_paid: 5000,
    status: "paid",
    payment_date: "2026-03-05",
    payment_method: "bank_transfer",
    receipt_number: "REC-2021",
  },
  {
    id: "pay-g9-4",
    shop_id: "shop-g9",
    year: 2026,
    month: 4,
    amount_due: 625,
    amount_paid: 5000,
    status: "paid",
    payment_date: "2026-04-05",
    payment_method: "bank_transfer",
    receipt_number: "REC-2022",
  },
  {
    id: "pay-g9-5",
    shop_id: "shop-g9",
    year: 2026,
    month: 5,
    amount_due: 625,
    amount_paid: 3000,
    status: "paid",
    payment_date: "2026-05-05",
    payment_method: "bank_transfer",
    receipt_number: "REC-2023",
  },
  {
    id: "pay-g9-6",
    shop_id: "shop-g9",
    year: 2026,
    month: 6,
    amount_due: 625,
    amount_paid: 6000,
    status: "paid",
    payment_date: "2026-06-05",
    payment_method: "bank_transfer",
    receipt_number: "REC-2024",
  },
  {
    id: "pay-g9-7",
    shop_id: "shop-g9",
    year: 2026,
    month: 7,
    amount_due: 625,
    amount_paid: 5000,
    status: "paid",
    payment_date: "2026-07-05",
    payment_method: "bank_transfer",
    receipt_number: "REC-2025",
  },
];

export interface ERPStoreState {
  branches: Branch[];
  currentBranchId: string;
  treasuries: TreasuryAccount[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  treasuryTransactions: TreasuryTransaction[];
  vouchers: Voucher[];
  accounts: Account[];
  journalEntries: JournalEntry[];
  auditLogs: AuditLog[];
  inventoryExpiry: {
    id: string;
    inventory_id: string;
    branch_id: string;
    warehouse_id?: string;
    storage_condition?: string;
    batch_no: string;
    quantity: number;
    expiry_date: string;
    created_at?: string;
  }[];
  menuQualitySpecs?: Record<string, MenuItemQualitySpecs>;
  costCenters: string[];
  isAccountingPeriodLocked: boolean;
  extendedInventoryItems: Record<string, ExtendedInventoryItem>;
  inventoryDocuments: InventoryDocument[];
  reconciliations: TreasuryReconciliation[];
  userPermissions: Record<string, UserPermission>;
  currentUser: string;
  users: SystemUser[];
  fiscalYearStatus: "open" | "closed";
  inventorySettings?: InventorySettings;
  totalDisposedExpiryValue?: number;
  mock_data_cleared_v6?: boolean;
  employees?: Employee[];
  attendance?: AttendanceRecord[];
  loans?: EmployeeLoan[];
  payrolls?: PayrollRecord[];
  mallShops: MallShop[];
  mallPayments: MallRentalPayment[];
  mallGardenRevenues: MallGardenRevenue[];
  mallGardenExpenses: MallGardenExpense[];
  mallTerminatedContractsArchive: TerminatedContractRecord[];
  parkTicketItems?: ParkTicketItem[];
  parkCustomers?: ParkCustomer[];
  parkOperationalTreasuries?: ParkOperationalTreasury[];
  parkTicketTransactions?: ParkTicketTransaction[];
  parkShifts?: ParkShift[];
  parkActiveShift?: ParkShift | null;
  park_shifts_cleared_2026_09_03_clean?: boolean;
  park_shifts_v2_hard_reset_2026_09_03?: boolean;
  park_sales_hard_zero_reset_v4_2026_09_03?: boolean;
  restaurantShifts?: RestaurantShift[];
  restaurantActiveShift?: RestaurantShift | null;
  restaurantRefundRecords?: RestaurantRefundRecord[];
}

const DEFAULT_BRANCHES: Branch[] = [
  { id: "branch-1", name: "Main Branch", name_ar: "الفرع الرئيسي", code: "MAIN" },
];

const DEFAULT_COST_CENTERS = [
  "المطبخ (Kitchen)",
  "البار (Bar)",
  "التوصيل (Delivery)",
  "الإدارة (Administration)",
  "التسويق (Marketing)",
  "المستودع (Warehouse)",
];

const getOffsetISO = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
};

const USD_SEED_TRANSACTIONS: TreasuryTransaction[] = [];
const EGP_SEED_TRANSACTIONS: TreasuryTransaction[] = [];

const DEFAULT_EXPIRY_SEED = [];

const DEFAULT_ACCOUNTS: Account[] = ORACLE_MIGRATION_ACCOUNTS as any;

export const SEED_AH_JOURNAL_ENTRIES: JournalEntry[] = [];

const DEFAULT_TREASURIES: TreasuryAccount[] = [
  {
    id: "tr-1",
    account_code: "13010130",
    branch_id: "branch-1",
    name_ar: "خزينة الكاشير",
    type: "cash",
    currency: "MULTI",
    linked_to_restaurant: true,
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "كاشير المطعم",
    status: "active",
    deleted: false,
    containers: [
      { id: "cnt-cash-egp", name: "كاش مصري", currency: "EGP", balance: 0 },
      { id: "cnt-card-egp", name: "فيزا مصري", currency: "EGP", balance: 0 },
      { id: "cnt-wallet-egp", name: "محفظة مصري", currency: "EGP", balance: 0 },
      { id: "cnt-cash-usd", name: "كاش دولار", currency: "USD", balance: 0 },
      { id: "cnt-card-usd", name: "فيزا دولار", currency: "USD", balance: 0 },
      { id: "cnt-wallet-usd", name: "محفظة دولار", currency: "USD", balance: 0 },
      { id: "cnt-cash-ssp", name: "كاش سوداني", currency: "SSP", balance: 0 },
      { id: "cnt-wallet-ssp", name: "محفظة سوداني", currency: "SSP", balance: 0 },
      { id: "cnt-card-ssp", name: "فيزا سوداني", currency: "SSP", balance: 0 },
    ],
  },
  {
    id: "tr-oracle-13010100",
    account_code: "13010100",
    branch_id: "branch-1",
    name_ar: "خزينة بالدولار",
    type: "cash",
    currency: "USD",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13010101",
    account_code: "13010101",
    branch_id: "branch-1",
    name_ar: "خزينة دولار - كينيدي",
    type: "cash",
    currency: "USD",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "كينيدي",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13010102",
    account_code: "13010102",
    branch_id: "branch-1",
    name_ar: "خزينة دولار - 501",
    type: "cash",
    currency: "USD",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13010103",
    account_code: "13010103",
    branch_id: "branch-1",
    name_ar: "خزينة دولار - الادارة",
    type: "cash",
    currency: "USD",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13010105",
    account_code: "13010105",
    branch_id: "branch-1",
    name_ar: "خزينة بالدولار سنترال بوب",
    type: "cash",
    currency: "USD",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13010110",
    account_code: "13010110",
    branch_id: "branch-1",
    name_ar: "خزينة بالسوداني",
    type: "cash",
    currency: "SSP",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13010111",
    account_code: "13010111",
    branch_id: "branch-1",
    name_ar: "خزينة سوداني - كينيدي",
    type: "cash",
    currency: "SSP",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "كينيدي",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13010115",
    account_code: "13010115",
    branch_id: "branch-1",
    name_ar: "خزينة بالسوداني - سنترال بوب",
    type: "cash",
    currency: "SSP",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13010120",
    account_code: "13010120",
    branch_id: "branch-1",
    name_ar: "خزينه FM",
    type: "cash",
    currency: "MULTI",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
    containers: [
      { id: "cnt-cash-egp-13010120", name: "كاش مصري", currency: "EGP", balance: 0 },
      { id: "cnt-card-egp-13010120", name: "فيزا مصري", currency: "EGP", balance: 0 },
      { id: "cnt-cash-usd-13010120", name: "كاش دولار", currency: "USD", balance: 0 },
      { id: "cnt-card-usd-13010120", name: "فيزا دولار", currency: "USD", balance: 0 },
      { id: "cnt-cash-ssp-13010120", name: "كاش سوداني", currency: "SSP", balance: 0 },
      { id: "cnt-card-ssp-13010120", name: "فيزا سوداني", currency: "SSP", balance: 0 },
    ],
  },
  {
    id: "tr-oracle-13010125",
    account_code: "13010125",
    branch_id: "branch-1",
    name_ar: "خزينة مصري - الادارة",
    type: "cash",
    currency: "EGP",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13010135",
    account_code: "13010135",
    branch_id: "branch-1",
    name_ar: "خزينه تذاكر الدخول",
    type: "cash",
    currency: "MULTI",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
    containers: [
      { id: "cnt-cash-egp-13010135", name: "كاش مصري", currency: "EGP", balance: 0 },
      { id: "cnt-card-egp-13010135", name: "فيزا مصري", currency: "EGP", balance: 0 },
      { id: "cnt-cash-usd-13010135", name: "كاش دولار", currency: "USD", balance: 0 },
      { id: "cnt-card-usd-13010135", name: "فيزا دولار", currency: "USD", balance: 0 },
      { id: "cnt-cash-ssp-13010135", name: "كاش سوداني", currency: "SSP", balance: 0 },
      { id: "cnt-card-ssp-13010135", name: "فيزا سوداني", currency: "SSP", balance: 0 },
    ],
  },
  {
    id: "tr-oracle-13020100",
    account_code: "13020100",
    branch_id: "branch-1",
    name_ar: "CHARTER SSP",
    type: "bank",
    currency: "SSP",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13020110",
    account_code: "13020110",
    branch_id: "branch-1",
    name_ar: "CHARTER usd",
    type: "bank",
    currency: "USD",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13020120",
    account_code: "13020120",
    branch_id: "branch-1",
    name_ar: "EDEN SSP",
    type: "bank",
    currency: "SSP",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13020130",
    account_code: "13020130",
    branch_id: "branch-1",
    name_ar: "Equity ssp",
    type: "bank",
    currency: "SSP",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13020140",
    account_code: "13020140",
    branch_id: "branch-1",
    name_ar: "Equity usd",
    type: "bank",
    currency: "USD",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13020150",
    account_code: "13020150",
    branch_id: "branch-1",
    name_ar: "kcb SSP",
    type: "bank",
    currency: "SSP",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13020160",
    account_code: "13020160",
    branch_id: "branch-1",
    name_ar: "kcb usd",
    type: "bank",
    currency: "USD",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
  },
  {
    id: "tr-oracle-13030100",
    account_code: "13030100",
    branch_id: "branch-1",
    name_ar: "Equity SSP FM",
    type: "bank",
    currency: "SSP",
    balance: 0,
    is_open: true,
    opening_balance: 0,
    available_balance: 0,
    responsible_employee: "غير محدد",
    status: "active",
    deleted: false,
  },
];

const DEFAULT_SUPPLIERS: Supplier[] = ORACLE_MIGRATION_ACCOUNTS.filter(
  (a) => a.parent_code === "24010" || (a.code.startsWith("24010") && a.level === 4),
).map((a) => ({
  id: `sup-${a.code}`,
  name_ar: a.name_ar,
  phone: "",
  balance: 0,
  account_code: a.code,
  currency: (a.currency as any) || "USD",
  deleted: false,
}));

const LEGACY_DEFAULT_USER_IDS = new Set(["u-admin", "u-manager", "u-cashier"]);

/**
 * User Management is the only account source. Remove bundled demo accounts, but
 * retain every record created by the current Users page for reconciliation.
 */
function ensureCurrentManagedUsers(users: unknown): SystemUser[] {
  if (!Array.isArray(users)) return [];
  return users.filter(
    (user: any) =>
      user &&
      !LEGACY_DEFAULT_USER_IDS.has(String(user.id || "")) &&
      typeof user.username === "string" &&
      user.username.trim().length > 0,
  ) as SystemUser[];
}

const DEFAULT_PERMISSIONS: Record<string, UserPermission> = {
  admin: {
    orders: true,
    pos: true,
    captain: true,
    kitchen: true,
    delivery: true,
    inventory: true,
    hr: true,
    purchasing: true,
    production: true,
    treasury: true,
    accounting: true,
    journal_approval: true,
    expense_approval: true,
    revenue_approval: true,
    reports: true,
    cost_centers: true,
    branch_mgmt: true,
    audit_logs: true,
    users_roles: true,
  },
  manager: {
    orders: true,
    pos: true,
    captain: true,
    kitchen: true,
    delivery: true,
    inventory: true,
    hr: true,
    purchasing: true,
    production: true,
    treasury: false,
    accounting: true,
    journal_approval: false,
    expense_approval: true,
    revenue_approval: true,
    reports: true,
    cost_centers: true,
    branch_mgmt: false,
    audit_logs: false,
    users_roles: false,
  },
  cashier: {
    orders: true,
    pos: true,
    captain: true,
    kitchen: true,
    delivery: true,
    inventory: false,
    hr: false,
    purchasing: false,
    production: false,
    treasury: false,
    accounting: false,
    journal_approval: false,
    expense_approval: false,
    revenue_approval: false,
    reports: false,
    cost_centers: false,
    branch_mgmt: false,
    audit_logs: false,
    users_roles: false,
  },
  "admin@restaurant.com": {
    orders: true,
    pos: true,
    captain: true,
    kitchen: true,
    delivery: true,
    inventory: true,
    hr: true,
    purchasing: true,
    production: true,
    treasury: true,
    accounting: true,
    journal_approval: true,
    expense_approval: true,
    revenue_approval: true,
    reports: true,
    cost_centers: true,
    branch_mgmt: true,
    audit_logs: true,
    users_roles: true,
  },
  "accountant@restaurant.com": {
    orders: false,
    pos: false,
    captain: false,
    kitchen: false,
    delivery: false,
    inventory: true,
    hr: true,
    purchasing: true,
    production: true,
    treasury: false,
    accounting: true,
    journal_approval: false,
    expense_approval: true,
    revenue_approval: true,
    reports: true,
    cost_centers: true,
    branch_mgmt: false,
    audit_logs: false,
    users_roles: false,
  },
};

// @ts-nocheck
export class ERPStore {
  state;
  listeners = [];
  constructor() {
    this.state = this.loadState();
    this.state.users = ensureCurrentManagedUsers(this.state.users);
    const activeLocalUsername = String(this.state.currentUser || "").trim().toLowerCase();
    if (activeLocalUsername && !this.state.users.some(
      (user: any) => String(user.username || "").trim().toLowerCase() === activeLocalUsername,
    )) {
      this.state.currentUser = "";
    }
    this.state.legacy_users_purged_2026_10_10 = true;
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      try { localStorage.setItem("erp_store_state", JSON.stringify(this.state)); } catch { /* IndexedDB will persist the cleaned state. */ }
    }
    if (!this.state.park_sales_hard_zero_reset_v4_2026_09_03) {
      this.state.parkShifts = [];
      this.state.parkActiveShift = null;
      this.state.parkTicketTransactions = [];
      if (this.state.parkOperationalTreasuries) {
        this.state.parkOperationalTreasuries.forEach((t: any) => {
          t.balance = 0;
        });
      }
      if (this.state.journalEntries) {
        this.state.journalEntries = this.state.journalEntries.filter((je: any) => {
          const desc = String(je.description || "");
          const ref = String(je.reference || "");
          return (
            !desc.includes("تذاكر الحديقة") &&
            !desc.includes("إغلاق وردية تذاكر") &&
            !desc.includes("ترحيل خزينة تذاكر") &&
            !ref.startsWith("PK-") &&
            !ref.startsWith("REF-PK-") &&
            !ref.startsWith("SH-")
          );
        });
      }
      this.state.park_sales_hard_zero_reset_v4_2026_09_03 = true;
      this.saveState();
      this.saveToIDB(this.state);
    }
    // Clean and validate park shifts: ensure integrity without arbitrary suppression
    if (this.state.parkShifts && this.state.parkShifts.length > 0) {
      const validShifts = this.state.parkShifts.filter((s: any) => {
        return Boolean(s && s.id && (s.shift_number || s.auto_shift_number));
      });
      if (validShifts.length !== this.state.parkShifts.length) {
        shiftAuditService.logShiftAction({
          shift_id: "cleanup-init",
          shift_type: "park",
          shift_number: "فحص التهيئة",
          action: "FILTER_ANOMALY",
          details: `تم تنظيف ${this.state.parkShifts.length - validShifts.length} وردية تالفة بدون معرف أو رقم`,
        });
      }
      this.state.parkShifts = validShifts;

      // Ensure active session pointer is valid and open
      if (this.state.parkActiveShift) {
        const activeExists = this.state.parkShifts.some((s) => s.id === this.state.parkActiveShift?.id);
        if (!activeExists || this.state.parkActiveShift.status !== "open") {
          this.state.parkActiveShift = null;
        }
      }
      this.saveState();
    }
    this.recalculateAccountBalances();
    this.initIndexedDB();

    if (typeof window !== "undefined") {
      window.addEventListener("storage", (e) => {
        if (e.key === "restocash_erp_state" && e.newValue) {
          try {
            const newState = JSON.parse(e.newValue);
            const cleanedUsers = ensureCurrentManagedUsers(newState.users);
            const normalizedCurrentUser = String(newState.currentUser || "").trim().toLowerCase();
            const cleanedCurrentUser = cleanedUsers.some(
              (user: any) => String(user.username || "").trim().toLowerCase() === normalizedCurrentUser,
            ) ? newState.currentUser : "";
            this.state = {
              ...newState,
              users: cleanedUsers,
              currentUser: cleanedCurrentUser,
              legacy_users_purged_2026_10_10: true,
            };
            this.notify();
          } catch (err) {
            console.error("Failed to parse ERP state from storage event:", err);
          }
        }
      });
    }
  }

  saveToIDB(data) {
    if (typeof window === "undefined" || !window.indexedDB) return;
    try {
      const request = window.indexedDB.open("ERP_STORE_DB", 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("kv")) {
          db.createObjectStore("kv");
        }
      };
      request.onsuccess = (e) => {
        try {
          const db = e.target.result;
          const tx = db.transaction("kv", "readwrite");
          const store = tx.objectStore("kv");
          store.put(data, "erp_store_state");
        } catch (err) {
          console.warn("IndexedDB write failed:", err);
        }
      };
    } catch (err) {
      console.warn("IndexedDB open failed:", err);
    }
  }

  initIndexedDB() {
    if (typeof window === "undefined" || !window.indexedDB) return;
    try {
      const request = window.indexedDB.open("ERP_STORE_DB", 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("kv")) {
          db.createObjectStore("kv");
        }
      };
      request.onsuccess = (e) => {
        try {
          const db = e.target.result;
          const tx = db.transaction("kv", "readonly");
          const store = tx.objectStore("kv");
          const getReq = store.get("erp_store_state");
          getReq.onsuccess = () => {
            if (getReq.result) {
              const idbState = getReq.result;
              if (!idbState.park_sales_hard_zero_reset_v4_2026_09_03) {
                idbState.parkShifts = [];
                idbState.parkActiveShift = null;
                idbState.parkTicketTransactions = [];
                if (idbState.parkOperationalTreasuries) {
                  idbState.parkOperationalTreasuries.forEach((t: any) => {
                    t.balance = 0;
                  });
                }
                idbState.park_sales_hard_zero_reset_v4_2026_09_03 = true;
                this.saveToIDB(idbState);
              }

              const originalIdbUsers = Array.isArray(idbState.users) ? idbState.users : [];
              const cleanedIdbUsers = ensureCurrentManagedUsers(originalIdbUsers);
              const idbCurrentName = String(idbState.currentUser || "").trim().toLowerCase();
              const cleanedIdbCurrentUser = cleanedIdbUsers.some(
                (user: any) => String(user.username || "").trim().toLowerCase() === idbCurrentName,
              ) ? idbState.currentUser : "";
              const idbUserStateChanged =
                cleanedIdbUsers.length !== originalIdbUsers.length ||
                cleanedIdbCurrentUser !== (idbState.currentUser || "") ||
                idbState.legacy_users_purged_2026_10_10 !== true;
              if (idbUserStateChanged) {
                idbState.users = cleanedIdbUsers;
                idbState.currentUser = cleanedIdbCurrentUser;
                idbState.legacy_users_purged_2026_10_10 = true;
                this.saveToIDB(idbState);
              }

              const idbEntriesCount = idbState.journalEntries?.length || 0;
              const currentEntriesCount = this.state.journalEntries?.length || 0;
              const idbUpdated = idbState._updatedAt || 0;
              const currentUpdated = this.state._updatedAt || 0;

              if (idbEntriesCount > currentEntriesCount || idbUpdated > currentUpdated) {
                const cleanedIdbShifts = (idbState.parkShifts || []).filter((s: any) => {
                  return Boolean(s && s.id && (s.shift_number || s.auto_shift_number));
                });
                this.state = {
                  ...this.getDefaultState(),
                  ...idbState,
                  users: ensureCurrentManagedUsers(idbState.users),
                  currentUser: ensureCurrentManagedUsers(idbState.users).some(
                    (user: any) => String(user.username || "").trim().toLowerCase() === String(idbState.currentUser || "").trim().toLowerCase(),
                  ) ? idbState.currentUser : "",
                  legacy_users_purged_2026_10_10: true,
                  parkShifts: idbState.park_sales_hard_zero_reset_v4_2026_09_03
                    ? cleanedIdbShifts
                    : [],
                  parkActiveShift: idbState.park_sales_hard_zero_reset_v4_2026_09_03
                    ? idbState.parkActiveShift || null
                    : null,
                  parkTicketTransactions: idbState.park_sales_hard_zero_reset_v4_2026_09_03
                    ? idbState.parkTicketTransactions || []
                    : [],
                  park_sales_hard_zero_reset_v4_2026_09_03: true,
                };
                this.recalculateAccountBalances();
                this.notify();
              }
            }
          };
        } catch (err) {
          console.warn("IndexedDB read failed:", err);
        }
      };
    } catch (err) {
      console.warn("IndexedDB init failed:", err);
    }
  }
  loadState() {
    if (typeof window === "undefined" || typeof localStorage === "undefined")
      return this.getDefaultState();
    const raw = localStorage.getItem("erp_store_state");
    if (raw)
      try {
        const parsed = JSON.parse(raw);
        let treasuries =
          parsed.treasuries?.map((t) => {
            const currency = t.currency;
            return {
              ...t,
              currency: currency || "EGP",
              branch_id: "branch-1",
              name_ar: t.id === "tr-3" ? "خزينة الكاش الإضافية" : t.name_ar,
              available_balance: t.available_balance ?? t.balance,
              responsible_employee: t.responsible_employee ?? "غير محدد",
              status: t.status ?? "active",
              deleted: !!t.deleted,
            };
          }) || DEFAULT_TREASURIES;
        const t225 = treasuries.find((t) => t.name_ar && t.name_ar.includes("225"));
        if (t225) {
          treasuries = treasuries.filter((t) => t.id !== t225.id);
          if (parsed.treasuryTransactions)
            parsed.treasuryTransactions = parsed.treasuryTransactions.filter(
              (tx) => tx.treasury_id !== t225.id,
            );
        }
        treasuries = treasuries.filter(
          (t) => t.id !== "tr-300" && t.name_ar !== "300" && !t.name_ar?.includes("300"),
        );
        treasuries = treasuries.filter(
          (t) =>
            t.id !== "tr-admin-usd" &&
            t.name_ar !== "خزينة الإدارة دولار" &&
            t.name_ar !== "خزينة دولار الإدارة" &&
            !t.name_ar?.includes("الإدارة دولار") &&
            !t.name_ar?.includes("دولار الإدارة"),
        );
        if (parsed.treasuryTransactions)
          parsed.treasuryTransactions = parsed.treasuryTransactions.filter(
            (tx) => tx.treasury_id !== "tr-admin-usd",
          );
        if (parsed.treasuryTransactions)
          parsed.treasuryTransactions.forEach((tx) => {
            if (tx.treasury_id === "tr-300") tx.treasury_id = "tr-1";
          });
        const defaultSalesContainers = [
          {
            id: "cnt-cash-egp",
            name: "كاش مصري",
            currency: "EGP",
            balance: 0,
          },
          {
            id: "cnt-card-egp",
            name: "فيزا مصري",
            currency: "EGP",
            balance: 0,
          },
          {
            id: "cnt-wallet-egp",
            name: "محفظة مصري",
            currency: "EGP",
            balance: 0,
          },
          {
            id: "cnt-cash-usd",
            name: "كاش دولار",
            currency: "USD",
            balance: 0,
          },
          {
            id: "cnt-card-usd",
            name: "فيزا دولار",
            currency: "USD",
            balance: 0,
          },
          {
            id: "cnt-wallet-usd",
            name: "محفظة دولار",
            currency: "USD",
            balance: 0,
          },
          {
            id: "cnt-cash-ssp",
            name: "كاش سوداني",
            currency: "SSP",
            balance: 0,
          },
          {
            id: "cnt-card-ssp",
            name: "فيزا سوداني",
            currency: "SSP",
            balance: 0,
          },
          {
            id: "cnt-wallet-ssp",
            name: "محفظة سوداني",
            currency: "SSP",
            balance: 0,
          },
        ];
        const validSalesContainerIds = new Set(defaultSalesContainers.map((c) => c.id));
        let mainCashier = treasuries.find(
          (t) =>
            t.id === "tr-1" ||
            t.linked_to_restaurant ||
            (t.name_ar && t.name_ar.includes("الكاشير")),
        );
        if (!mainCashier) {
          mainCashier = {
            id: "tr-1",
            branch_id: "branch-1",
            name_ar: "خزينة الكاشير",
            type: "cash",
            currency: "MULTI",
            linked_to_restaurant: true,
            balance: 15e3,
            is_open: true,
            account_code: "13010130",
            opening_balance: 15e3,
            available_balance: 15e3,
            responsible_employee: "أحمد علي",
            status: "active",
            deleted: false,
            containers: defaultSalesContainers,
          };
          treasuries.push(mainCashier);
        } else {
          mainCashier.id = "tr-1";
          mainCashier.name_ar = "خزينة الكاشير";
          mainCashier.linked_to_restaurant = true;
          mainCashier.deleted = false;
          mainCashier.currency = "MULTI";
          const cleanedContainers = (mainCashier.containers || []).filter((c) =>
            validSalesContainerIds.has(c.id),
          );
          defaultSalesContainers.forEach((dc) => {
            if (!cleanedContainers.some((c) => c.id === dc.id)) cleanedContainers.push({ ...dc });
          });
          mainCashier.containers = cleanedContainers;
        }
        treasuries.forEach((t) => {
          if (t.id !== "tr-1") t.linked_to_restaurant = false;
        });
        const seenTreasuryIds = /* @__PURE__ */ new Set();
        treasuries = treasuries.filter((t) => {
          if (!t.id || seenTreasuryIds.has(t.id)) return false;
          seenTreasuryIds.add(t.id);
          return true;
        });
        const loadedAccounts =
          parsed.accounts !== void 0 && Array.isArray(parsed.accounts)
            ? parsed.accounts.map((a) => ({
                ...a,
                level: a.level ?? 2,
                status: a.status ?? "active",
              }))
            : [...DEFAULT_ACCOUNTS];
        ORACLE_MIGRATION_ACCOUNTS.forEach((oracleAcc) => {
          if (!loadedAccounts.some((a) => a.code === oracleAcc.code))
            loadedAccounts.push({
              ...oracleAcc,
              balance: 0,
              initial_balance: 0,
              status: "active",
              system_binding: "none",
            });
        });
        const loadedSuppliers =
          parsed.suppliers?.map((s) => ({
            ...s,
            deleted: !!s.deleted,
          })) || DEFAULT_SUPPLIERS;
        const loadedTreasuries = treasuries;
        DEFAULT_TREASURIES.forEach((dt) => {
          if (
            dt.id !== "tr-admin-usd" &&
            !loadedTreasuries.some((lt) => lt.id === dt.id || lt.deleted)
          )
            loadedTreasuries.push({ ...dt });
        });
        loadedTreasuries.forEach((t) => {
          if (!t.account_code) {
            const dt = DEFAULT_TREASURIES.find((d) => d.id === t.id);
            if (dt?.account_code) {
              t.account_code = dt.account_code;
            }
          }
        });
        const loadedJournalEntries = Array.isArray(parsed.journalEntries)
          ? parsed.journalEntries
          : [];
        const loadedTreasuryTransactions = Array.isArray(parsed.treasuryTransactions)
          ? parsed.treasuryTransactions
          : [];
        const loadedVouchers = Array.isArray(parsed.vouchers) ? parsed.vouchers : [];
        const loadedReconciliations = Array.isArray(parsed.reconciliations)
          ? parsed.reconciliations
          : [];

        return {
          branches: DEFAULT_BRANCHES,
          currentBranchId: "branch-1",
          treasuries: loadedTreasuries,
          suppliers: loadedSuppliers,
          purchaseOrders: (parsed.purchaseOrders || []).map((po) => ({
            ...po,
            branch_id: "branch-1",
          })),
          treasuryTransactions: loadedTreasuryTransactions.map((tx) => ({
            ...tx,
            branch_id: "branch-1",
          })),
          vouchers: loadedVouchers.map((v) => ({
            ...v,
            branch_id: "branch-1",
            deleted: !!v.deleted,
          })),
          accounts: loadedAccounts,
          journalEntries: loadedJournalEntries,
          auditLogs: parsed.auditLogs || [],
          inventoryExpiry:
            parsed.inventoryExpiry && parsed.inventoryExpiry.length > 0
              ? parsed.inventoryExpiry
              : DEFAULT_EXPIRY_SEED,
          menuQualitySpecs: parsed.menuQualitySpecs || {},
          costCenters: parsed.costCenters || DEFAULT_COST_CENTERS,
          isAccountingPeriodLocked: !!parsed.isAccountingPeriodLocked,
          extendedInventoryItems: parsed.extendedInventoryItems || {},
          inventoryDocuments: (parsed.inventoryDocuments || []).map((doc) => ({
            ...doc,
            branch_id: "branch-1",
          })),
          reconciliations: loadedReconciliations,
          userPermissions: parsed.userPermissions || DEFAULT_PERMISSIONS,
          currentUser: parsed.currentUser || "",
          users: ensureCurrentManagedUsers(parsed.users),
          fiscalYearStatus: parsed.fiscalYearStatus || "open",
          inventorySettings: parsed.inventorySettings || {
            allowNegativeStock: true,
            defaultUnit: "كيلو",
          },
          totalDisposedExpiryValue: Number(parsed.totalDisposedExpiryValue || 0),
          hard_reset_2026_08_18_final: true,
          mock_data_cleared_v6: true,
          wipe_journal_entries_2026_08_18_v3: true,
          employees: parsed.employees || DEFAULT_EMPLOYEES,
          attendance: parsed.attendance || [],
          loans: parsed.loans || [],
          payrolls: parsed.payrolls || [],
          mallShops:
            parsed.mallShops && parsed.mallShops.length > 0 ? parsed.mallShops : DEFAULT_MALL_SHOPS,
          mallPayments:
            parsed.mallPayments && parsed.mallPayments.length > 0
              ? parsed.mallPayments
              : DEFAULT_MALL_PAYMENTS,
          mallGardenRevenues:
            parsed.mallGardenRevenues && parsed.mallGardenRevenues.length > 0
              ? parsed.mallGardenRevenues
              : DEFAULT_GARDEN_REVENUES,
          mallGardenExpenses:
            parsed.mallGardenExpenses && parsed.mallGardenExpenses.length > 0
              ? parsed.mallGardenExpenses
              : DEFAULT_GARDEN_EXPENSES,
          mallTerminatedContractsArchive: parsed.mallTerminatedContractsArchive || [],
          parkTicketItems:
            parsed.parkTicketItems && parsed.parkTicketItems.length > 0
              ? parsed.parkTicketItems
              : DEFAULT_PARK_TICKET_ITEMS,
          parkCustomers:
            parsed.parkCustomers && parsed.parkCustomers.length > 0
              ? parsed.parkCustomers
              : DEFAULT_PARK_CUSTOMERS,
          parkOperationalTreasuries:
            parsed.parkOperationalTreasuries && parsed.parkOperationalTreasuries.length > 0
              ? parsed.park_sales_hard_zero_reset_v4_2026_09_03
                ? parsed.parkOperationalTreasuries
                : parsed.parkOperationalTreasuries.map((t: any) => ({ ...t, balance: 0 }))
              : DEFAULT_PARK_OPERATIONAL_TREASURIES,
          parkTicketTransactions: parsed.park_sales_hard_zero_reset_v4_2026_09_03
            ? parsed.parkTicketTransactions || []
            : [],
          parkShifts: parsed.park_sales_hard_zero_reset_v4_2026_09_03
            ? (parsed.parkShifts || []).filter((s: any) => {
                return Boolean(s && s.id && (s.shift_number || s.auto_shift_number));
              })
            : [],
          parkActiveShift: parsed.park_sales_hard_zero_reset_v4_2026_09_03
            ? parsed.parkActiveShift || null
            : null,
          park_sales_hard_zero_reset_v4_2026_09_03: true,
          park_shifts_v2_hard_reset_2026_09_03: true,
          park_shifts_cleared_2026_09_03_clean: true,
          restaurantShifts: parsed.restaurantShifts || [],
          restaurantActiveShift: parsed.restaurantActiveShift || null,
          restaurantRefundRecords: parsed.restaurantRefundRecords || [],
        };
      } catch (e) {
        console.error("Error parsing ERP state:", e);
      }
    return this.getDefaultState();
  }

  clearAllJournalEntries() {
    this.state.journalEntries = [];
    if (Array.isArray(this.state.treasuryTransactions)) {
      this.state.treasuryTransactions = this.state.treasuryTransactions.filter(
        (tx) =>
          !tx.id?.startsWith("tx-import-") &&
          !tx.related_entity_id?.startsWith("ORACLE-") &&
          !tx.related_entity_id?.startsWith("je-"),
      );
    }
    this.state.accounts.forEach((a) => {
      a.balance = Number(a.initial_balance || 0);
    });
    this.recalculateAccountBalances();
    this.saveState();
    this.logAction(
      "ADMIN",
      "مسح قيود اليومية",
      "تم مسح جميع قيود اليومية العامة من الذاكرة بالكامل",
      "DELETE",
    );
    this.notify();
  }

  deleteAllSystemData() {
    const s = this.getDefaultState();
    s.hard_reset_2026_08_18_final = true;
    s.wipe_journal_entries_2026_08_18_v3 = true;
    s.treasuryTransactions = [];
    s.journalEntries = [];
    s.vouchers = [];
    s.purchaseOrders = [];
    s.inventoryDocuments = [];
    s.orders = [];
    s.mallGardenRevenues = [];
    s.mallGardenExpenses = [];
    s.mallPayments = [];
    s.mallShops = [];
    s.attendance = [];
    s.loans = [];
    s.payrolls = [];
    s.auditLogs = [];

    s.treasuries = JSON.parse(JSON.stringify(DEFAULT_TREASURIES));
    s.treasuries.forEach((t) => {
      t.balance = 0;
      t.opening_balance = 0;
      t.available_balance = 0;
      if (t.containers) t.containers.forEach((c) => (c.balance = 0));
    });
    s.accounts.forEach((a) => {
      a.balance = 0;
      a.opening_balance = 0;
    });

    this.state = s;
    this.recalculateAccountBalances();
    this.saveState();
    this.notify();

    if (typeof window !== "undefined") {
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  }
  getDefaultState() {
    return {
      branches: DEFAULT_BRANCHES,
      currentBranchId: "branch-1",
      treasuries: DEFAULT_TREASURIES,
      suppliers: DEFAULT_SUPPLIERS,
      purchaseOrders: [],
      treasuryTransactions: [],
      vouchers: [],
      accounts: DEFAULT_ACCOUNTS,
      journalEntries: [],
      auditLogs: [],
      inventoryExpiry: DEFAULT_EXPIRY_SEED,
      menuQualitySpecs: {},
      costCenters: DEFAULT_COST_CENTERS,
      isAccountingPeriodLocked: false,
      extendedInventoryItems: {},
      inventoryDocuments: [],
      reconciliations: [],
      userPermissions: DEFAULT_PERMISSIONS,
      currentUser: "",
      users: [],
      fiscalYearStatus: "open",
      inventorySettings: {
        allowNegativeStock: true,
        defaultUnit: "كيلو",
      },
      totalDisposedExpiryValue: 0,
      employees: DEFAULT_EMPLOYEES,
      attendance: [],
      loans: [],
      payrolls: [],
      mallShops: DEFAULT_MALL_SHOPS,
      mallPayments: DEFAULT_MALL_PAYMENTS,
      mallGardenRevenues: DEFAULT_GARDEN_REVENUES,
      mallGardenExpenses: DEFAULT_GARDEN_EXPENSES,
      mallTerminatedContractsArchive: [],
      parkTicketItems: DEFAULT_PARK_TICKET_ITEMS,
      parkCustomers: DEFAULT_PARK_CUSTOMERS,
      parkOperationalTreasuries: DEFAULT_PARK_OPERATIONAL_TREASURIES,
      parkTicketTransactions: [],
      parkShifts: [],
      parkActiveShift: null,
      park_shifts_cleared_2026_09_03_clean: true,
      restaurantShifts: [],
      restaurantActiveShift: null,
      restaurantRefundRecords: [],
    };
  }
  saveState() {
    if (this.state.journalEntries) this.state.journalEntries = [...this.state.journalEntries];
    if (this.state.accounts) this.state.accounts = [...this.state.accounts];
    if (this.state.treasuryTransactions)
      this.state.treasuryTransactions = [...this.state.treasuryTransactions];
    if (this.state.treasuries) this.state.treasuries = [...this.state.treasuries];

    this.state._updatedAt = Date.now();

    this.saveToIDB(this.state);

    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("erp_store_state", JSON.stringify(this.state));
      } catch (err) {
        // Attempt to save a pruned copy (removing heavy audit logs) so localStorage receives latest entries
        try {
          const prunedState = {
            ...this.state,
            auditLogs: (this.state.auditLogs || []).slice(0, 30),
            deletedJournalEntries: (this.state.deletedJournalEntries || []).slice(0, 10),
            mallTerminatedContractsArchive: [],
          };
          localStorage.setItem("erp_store_state", JSON.stringify(prunedState));
        } catch (err2) {
          try {
            const ultraPrunedState = {
              ...this.state,
              auditLogs: [],
              deletedJournalEntries: [],
              mallTerminatedContractsArchive: [],
            };
            localStorage.setItem("erp_store_state", JSON.stringify(ultraPrunedState));
          } catch (err3) {
            // Full state safely persisted in IndexedDB and in-memory
          }
        }
      }
    }
    this.notify();
  }
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
  notify() {
    this.state = { ...this.state };
    this.listeners.forEach((l) => l(this.getState()));
  }
  resetRestaurantSales() {
    this.state.sales_invoices = [];
    this.state.treasuryTransactions = this.state.treasuryTransactions.filter(
      (t) => t.type !== "sale" && t.type !== "income",
    );
    this.state.journalEntries = this.state.journalEntries.filter(
      (j) => !j.description?.includes("فاتورة مبيعات"),
    );
    const linkedTreasury = this.state.treasuries.find((t) => t.linked_to_restaurant);
    if (linkedTreasury) linkedTreasury.balance = 0;
    this.saveState();
  }
  getState() {
    return this.state;
  }
  getCurrentBranch() {
    return (
      this.state.branches.find((b) => b.id === this.state.currentBranchId) || this.state.branches[0]
    );
  }
  setCurrentBranch(branchId) {
    this.state.currentBranchId = branchId;
    this.saveState();
    this.logAction(
      "SYSTEM",
      "تغيير الفرع الحالي",
      `تم الانتقال إلى الفرع ذو المعرف ${branchId}`,
      "SYSTEM",
    );
  }
  logAction(user, action, details, actionType = "SYSTEM", beforeValue, afterValue) {
    const log = {
      id: "log-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      user_email: user,
      action,
      details,
      created_at: /* @__PURE__ */ new Date().toISOString(),
      action_type: actionType,
      before_value: beforeValue,
      after_value: afterValue,
      ip_address: "127.0.0.1",
    };
    this.state.auditLogs.unshift(log);
    this.saveState();
  }
  getUsers() {
    return this.state.users || [];
  }
  upsertUser(user) {
    if (!this.state.users) this.state.users = [];
    const idx = this.state.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) this.state.users[idx] = user;
    else this.state.users.push(user);
    this.saveState();
  }
  deleteUser(id) {
    if (!this.state.users) return;
    const target = this.state.users.find((user) => user.id === id);
    this.state.users = this.state.users.filter((user) => user.id !== id);
    const username = String(target?.username || "").trim().toLowerCase();
    const reservedRoleNames = new Set(["admin", "super_admin", "manager", "cashier", "captain", "kitchen"]);
    if (username && !reservedRoleNames.has(username)) delete this.state.userPermissions?.[username];
    this.saveState();
  }
  setCurrentUser(email) {
    this.state.currentUser = email;
    this.saveState();
    this.logAction("SYSTEM", "تغيير المستخدم النشط", `تم تسجيل دخول المستخدم: ${email}`, "SYSTEM");
  }
  updateUserPermission(email, permissions) {
    const existing = this.state.userPermissions[email] || {
      treasury: false,
      accounting: false,
      journal_approval: false,
      expense_approval: false,
      revenue_approval: false,
      reports: false,
      cost_centers: false,
      branch_mgmt: false,
      audit_logs: false,
    };
    this.state.userPermissions[email] = {
      ...existing,
      ...permissions,
    };
    this.saveState();
    this.logAction("ADMIN", "تحديث صلاحيات مستخدم", `تم تحديث صلاحيات ${email}`, "UPDATE");
  }
  addBranch(name, name_ar, code) {
    const branch = {
      id: "branch-" + Date.now(),
      name,
      name_ar,
      code,
    };
    this.state.branches.push(branch);
    this.saveState();
    this.logAction("ADMIN", "إضافة فرع جديد", `تم إنشاء فرع جديد: ${name_ar} (${code})`, "CREATE");
    return branch;
  }
  clearAllAccountsAndTransactions() {
    this.state.accounts = [];
    this.state.treasuryTransactions = [];
    this.state.journalEntries = [];
    this.state.vouchers = [];
    this.state.purchaseOrders = [];
    this.state.inventoryDocuments = [];
    if (typeof window !== "undefined" && typeof localStorage !== "undefined")
      localStorage.removeItem("pos_local_orders");
    this.saveState();
    this.logAction(
      "ADMIN",
      "مسح كامل الحسابات والحركات",
      "تم تفريغ جميع الحسابات والحركات المالية لإعادة البدء بدليل نظيف",
      "DELETE",
    );
  }
  addSupplier(
    name_ar: string,
    phone?: string,
    openingBalance: number = 0,
    account_code?: string,
    currency: string = "USD",
  ) {
    let targetAccountCode = account_code ? String(account_code).trim() : "";
    let isNewAccount = false;

    // If no account code is provided, auto-create a dedicated supplier account in Chart of Accounts under 24010
    if (!targetAccountCode) {
      const existingSupplierCodes = this.state.accounts
        .map((a) => a.code)
        .filter((c) => c.startsWith("24010") && c.length === 8);

      let maxSuffix = 390;
      existingSupplierCodes.forEach((code) => {
        const suffix = parseInt(code.substring(5), 10);
        if (!isNaN(suffix) && suffix > maxSuffix) {
          maxSuffix = suffix;
        }
      });

      const nextSuffix = maxSuffix + 1;
      targetAccountCode = `24010${String(nextSuffix).padStart(3, "0")}`;
      isNewAccount = true;

      if (!this.state.accounts.some((a) => a.code === targetAccountCode)) {
        const newAcc: Account = {
          code: targetAccountCode,
          name_ar: `مورد - ${name_ar}`,
          type: "liability",
          level: 4,
          parent_code: "24010",
          balance: openingBalance,
          initial_balance: openingBalance,
          status: "active",
          currency: currency || "USD",
          system_binding: "none",
        };
        this.state.accounts.push(newAcc);
      }
    } else {
      const existing = this.state.accounts.find((a) => a.code === targetAccountCode);
      if (!existing) {
        this.state.accounts.push({
          code: targetAccountCode,
          name_ar: `مورد - ${name_ar}`,
          type: "liability",
          level: 4,
          parent_code: "24010",
          balance: openingBalance,
          initial_balance: openingBalance,
          status: "active",
          currency: currency || "USD",
          system_binding: "none",
        });
        isNewAccount = true;
      }
    }

    const supplier: Supplier = {
      id: "sup-" + Date.now(),
      name_ar,
      phone: phone || "",
      balance: openingBalance,
      account_code: targetAccountCode,
      currency: currency || "USD",
      deleted: false,
    };

    this.state.suppliers.push(supplier);
    this.recalculateAccountBalances();
    this.saveState();
    this.logAction(
      "ADMIN",
      "إضافة مورد جديد",
      `تم تسجيل المورد: ${name_ar} وربطه بالحساب المحاسبي رقم (${targetAccountCode})`,
      "CREATE",
    );
    this.notify();
    return { supplier, account_code: targetAccountCode, isNewAccount };
  }
  deleteSupplier(id: string) {
    const sup = this.state.suppliers.find((s) => s.id === id);
    if (sup) {
      sup.deleted = true;
      this.saveState();
      this.logAction("ADMIN", "حذف مورد (حذف مؤقت)", `تم حذف المورد #${id} مؤقتاً`, "DELETE");
      this.notify();
    }
  }
  updateSupplier(id: string, payload: Partial<Supplier>) {
    const sup = this.state.suppliers.find((s) => s.id === id);
    if (sup) {
      Object.assign(sup, payload);
      // If account_code changed, sync
      if (payload.account_code) {
        const acc = this.state.accounts.find((a) => a.code === payload.account_code);
        if (acc && payload.name_ar) {
          acc.name_ar = `مورد - ${payload.name_ar}`;
        }
      }
      this.saveState();
      this.logAction("ADMIN", "تعديل بيانات مورد", `تم تعديل المورد: ${sup.name_ar}`, "UPDATE");
      this.notify();
    }
  }
  updateSupplierBalance(id: string, amount: number) {
    const sup = this.state.suppliers.find((s) => s.id === id);
    if (sup) {
      sup.balance += amount;
      this.saveState();
      this.notify();
    }
  }
  recordSupplierTransaction(params: {
    supplier_id: string;
    type: "payment" | "invoice" | "adjustment";
    amount: number;
    currency?: "USD" | "SSP" | string;
    exchange_rate?: number;
    treasury_id?: string;
    note?: string;
    date?: string;
  }) {
    const supplier = this.state.suppliers.find((s) => s.id === params.supplier_id);
    if (!supplier) throw new Error("المورد غير موجود");

    const supAccCode = supplier.account_code || "201000";
    const curr = params.currency || "USD";
    const rate = Number(params.exchange_rate) || 1;
    const rawAmount = Number(params.amount) || 0;
    const baseUsd = curr === "USD" ? rawAmount : rate > 1 ? rawAmount / rate : rawAmount * rate;
    const targetDate = params.date || new Date().toISOString().split("T")[0];

    const refSeq = Math.floor(Math.random() * 8999) + 1000;
    let ref = `SUP-TX-${refSeq}`;
    const lines: JournalLine[] = [];

    if (params.type === "payment") {
      // Payment to Supplier: Debit Supplier, Credit Treasury
      const treasury =
        this.state.treasuries.find((t) => t.id === params.treasury_id) || this.state.treasuries[0];
      const treasuryAccCode =
        treasury?.account_code || (treasury?.type === "bank" ? "13020140" : "13010100");
      ref = `SUP-PAY-${refSeq}`;

      lines.push({
        account_code: supAccCode,
        debit: rawAmount,
        credit: 0,
        currency: curr,
        rate: rate,
        description: params.note || `سداد دفعة نقدية للمورد ${supplier.name_ar}`,
      });

      lines.push({
        account_code: treasuryAccCode,
        debit: 0,
        credit: rawAmount,
        currency: curr,
        rate: rate,
        description: params.note || `سداد دفعة نقدية للمورد ${supplier.name_ar}`,
      });

      if (treasury) {
        this.addTreasuryTransaction(
          treasury.id,
          "purchase",
          rawAmount,
          curr,
          `سداد للمورد: ${supplier.name_ar} - ${params.note || ""}`,
          ref,
        );
      }

      supplier.balance -= rawAmount;
    } else if (params.type === "invoice") {
      // Additional Invoice/Claim: Debit Inventory/Expense, Credit Supplier
      ref = `SUP-INV-${refSeq}`;
      lines.push({
        account_code: "103000",
        debit: rawAmount,
        credit: 0,
        currency: curr,
        rate: rate,
        description: params.note || `فاتورة استحقاق بضاعة للمورد ${supplier.name_ar}`,
      });

      lines.push({
        account_code: supAccCode,
        debit: 0,
        credit: rawAmount,
        currency: curr,
        rate: rate,
        description: params.note || `فاتورة استحقاق بضاعة للمورد ${supplier.name_ar}`,
      });

      supplier.balance += rawAmount;
    } else {
      // Adjustment:
      ref = `SUP-ADJ-${refSeq}`;
      lines.push({
        account_code: supAccCode,
        debit: rawAmount > 0 ? rawAmount : 0,
        credit: rawAmount < 0 ? Math.abs(rawAmount) : 0,
        currency: curr,
        rate: rate,
        description: params.note || `تسوية رصيد حساب المورد ${supplier.name_ar}`,
      });

      lines.push({
        account_code: "17010100",
        debit: rawAmount < 0 ? Math.abs(rawAmount) : 0,
        credit: rawAmount > 0 ? rawAmount : 0,
        currency: curr,
        rate: rate,
        description: params.note || `تسوية رصيد حساب المورد ${supplier.name_ar}`,
      });

      supplier.balance -= rawAmount;
    }

    this.addJournalEntry(
      `حركة مورد (${supplier.name_ar}) - ${params.note || ref}`,
      lines,
      ref,
      curr,
      targetDate,
    );

    this.recalculateAccountBalances();
    this.saveState();
    this.logAction(
      "ADMIN",
      "تسجيل حركة مورد",
      `تم تسجيل حركة ${params.type} بمبلغ ${rawAmount.toLocaleString()} ${curr} للمورد ${supplier.name_ar} (حساب #${supAccCode}) برقم مرجعي ${ref}`,
      "TRANSACTION",
    );
    this.notify();

    return {
      success: true,
      reference: ref,
      account_code: supAccCode,
      supplier_name: supplier.name_ar,
      amount: rawAmount,
      currency: curr,
      base_usd_amount: baseUsd,
    };
  }
  addTreasury(
    name_ar,
    type,
    currency,
    openingBalance = 0,
    employee = "غير محدد",
    containers = [],
    linked_to_restaurant = false,
    account_code,
  ) {
    const treasury = {
      id: "tr-" + Date.now(),
      branch_id: this.state.currentBranchId,
      name_ar,
      type,
      currency,
      balance: openingBalance,
      is_open: true,
      account_code: void 0,
      opening_balance: openingBalance,
      available_balance: openingBalance,
      responsible_employee: employee,
      status: "active",
      deleted: false,
      containers,
      linked_to_restaurant,
    };
    this.state.treasuries.push(treasury);
    this.saveState();
    this.logAction(
      "ADMIN",
      "إضافة حساب خزينة/بنك",
      `تم إنشاء حساب ${name_ar} برصيد إفتتاحي ${openingBalance} ${currency}`,
      "CREATE",
    );
    return treasury;
  }
  updateTreasury(id, payload) {
    const tr = this.state.treasuries.find((t) => t.id === id);
    if (tr) {
      Object.assign(tr, payload);
      this.saveState();
      this.logAction("ADMIN", "تعديل حساب خزينة/بنك", `تم تعديل حساب: ${tr.name_ar}`, "UPDATE");
    }
  }
  setTreasuryOpenStatus(treasuryId, isOpen) {
    const tr = this.state.treasuries.find((t) => t.id === treasuryId);
    if (tr) {
      const oldState = tr.is_open;
      tr.is_open = isOpen;
      tr.status = isOpen ? "active" : "closed";
      this.saveState();
      this.logAction(
        "ADMIN",
        isOpen ? "فتح الخزينة اليومي" : "إغلاق الخزينة اليومي",
        `تم تغيير حالة خزينة ${tr.name_ar} إلى ${isOpen ? "مفتوحة" : "مغلقة"}`,
        "UPDATE",
        `isOpen: ${oldState}`,
        `isOpen: ${isOpen}`,
      );
    }
  }
  deleteTreasury(id) {
    const trIndex = this.state.treasuries.findIndex((t) => t.id === id);
    const tr = this.state.treasuries[trIndex];
    if (tr) {
      if (Math.abs(tr.balance) > 0.001)
        throw new Error(
          `لا يمكن حذف الخزينة وهي تحتوي على رصيد مالي نشط (${tr.balance.toLocaleString()} ${tr.currency}).`,
        );
      tr.deleted = true;
      tr.is_open = false;
      this.state.treasuries.splice(trIndex, 1);
      this.saveState();
      this.logAction("ADMIN", "حذف خزينة", `تم حذف الخزينة ${tr.name_ar}`, "DELETE");
    }
  }
  reconcileTreasury(treasuryId, actualCount, notes) {
    const tr = this.state.treasuries.find((t) => t.id === treasuryId);
    if (!tr) throw new Error("الخزينة غير موجودة");
    const ledgerBalance = tr.balance;
    const difference = actualCount - ledgerBalance;
    const recon = {
      id: "rec-" + Date.now(),
      treasury_id: treasuryId,
      date: /* @__PURE__ */ new Date().toISOString(),
      ledger_balance: ledgerBalance,
      actual_balance: actualCount,
      difference,
      reconciled_by: this.state.currentUser,
      notes,
    };
    if (!this.state.reconciliations) this.state.reconciliations = [];
    this.state.reconciliations.unshift(recon);
    tr.balance = actualCount;
    tr.available_balance = actualCount;
    this.postReconciliationJournal(recon, tr);
    this.saveState();
    this.logAction(
      "ADMIN",
      "تسوية ومطابقة خزينة",
      `تم تسوية خزينة ${tr.name_ar} بفارق ${difference.toFixed(2)} ج.م (جرد فعلي: ${actualCount})`,
      "TRANSACTION",
    );
  }
  postReconciliationJournal(recon, tr) {
    const treasuryAccountCode =
      tr.type === "bank" ? "102000" : tr.branch_id === "branch-2" ? "101001" : "101000";
    const diff = recon.difference;
    const curr = tr.currency || "USD";
    const rate = this.getExchangeRate(curr);
    const lines = [];
    if (diff > 0) {
      lines.push({
        account_code: treasuryAccountCode,
        debit: diff,
        credit: 0,
        currency: curr,
        rate: rate,
      });
      lines.push({
        account_code: "401000",
        debit: 0,
        credit: diff,
        currency: curr,
        rate: rate,
      });
    } else if (diff < 0) {
      lines.push({
        account_code: "506000",
        debit: Math.abs(diff),
        credit: 0,
        currency: curr,
        rate: rate,
      });
      lines.push({
        account_code: treasuryAccountCode,
        debit: 0,
        credit: Math.abs(diff),
        currency: curr,
        rate: rate,
      });
    }
    if (lines.length > 0)
      this.addJournalEntry(
        `تسوية جرد مالي لخزينة ${tr.name_ar}`,
        lines,
        `REC-${recon.id.substring(4, 9).toUpperCase()}`,
        curr,
      );
  }
  addTreasuryTransaction(
    treasuryId,
    type,
    amount,
    currency,
    note,
    relatedId,
    paymentMethod,
    containerId,
  ) {
    const tr = this.state.treasuries.find((t) => t.id === treasuryId);
    if (!tr) return;
    const beforeBal = tr.balance;
    if (type === "deposit" || type === "sales" || type === "transfer_in") {
      tr.balance += amount;
      tr.available_balance = tr.balance;
      if (containerId && tr.containers) {
        const cnt = tr.containers.find((c) => c.id === containerId);
        if (cnt) cnt.balance += amount;
      }
    } else {
      tr.balance -= amount;
      tr.available_balance = tr.balance;
      if (containerId && tr.containers) {
        const cnt = tr.containers.find((c) => c.id === containerId);
        if (cnt) cnt.balance -= amount;
      }
    }
    const tx = {
      id: "tx-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      branch_id: this.state.currentBranchId,
      treasury_id: treasuryId,
      type,
      amount,
      currency: currency || tr.currency || "USD",
      payment_method: paymentMethod || "cash",
      note,
      related_entity_id: relatedId,
      created_at: /* @__PURE__ */ new Date().toISOString(),
    };
    this.state.treasuryTransactions.unshift(tx);
    this.saveState();
    this.logAction(
      this.state.currentUser,
      "حركة مالية على الخزينة",
      `تم إجراء حركة ${type} بقيمة ${amount} ${tx.currency} على خزينة ${tr.name_ar}`,
      "TRANSACTION",
      `balance: ${beforeBal}`,
      `balance: ${tr.balance}`,
    );
    this.postTreasuryJournal(tx, tr);
  }
  postTreasuryJournal(tx, tr) {
    let debitAccount = "101000";
    let creditAccount = "301000";
    if (this.state.currentBranchId === "branch-2") debitAccount = "101001";
    else if (tr.type === "bank") debitAccount = "102000";
    if (tx.type === "sales") creditAccount = "401000";
    else if (tx.type === "expense") creditAccount = "504000";
    else if (tx.type === "purchase") creditAccount = "103000";
    const curr = tx.currency || tr.currency || "USD";
    const rate = this.getExchangeRate(curr);
    const lines = [];
    if (tx.type === "deposit" || tx.type === "sales" || tx.type === "transfer_in") {
      lines.push({
        account_code: debitAccount,
        debit: tx.amount,
        credit: 0,
        currency: curr,
        rate: rate,
      });
      lines.push({
        account_code: creditAccount,
        debit: 0,
        credit: tx.amount,
        currency: curr,
        rate: rate,
      });
    } else if (
      tx.type === "withdrawal" ||
      tx.type === "purchase" ||
      tx.type === "expense" ||
      tx.type === "transfer_out"
    ) {
      lines.push({
        account_code: creditAccount,
        debit: tx.amount,
        credit: 0,
        currency: curr,
        rate: rate,
      });
      lines.push({
        account_code: debitAccount,
        debit: 0,
        credit: tx.amount,
        currency: curr,
        rate: rate,
      });
    }
    if (lines.length > 0) {
      const entry = this.addJournalEntry(
        tx.note,
        lines,
        tx.related_entity_id,
        curr,
        tx.created_at ? tx.created_at.split("T")[0] : undefined,
      );
      if (entry && entry.reference) {
        tx.related_entity_id = entry.reference;
      }
    }
  }
  addAccount(
    code,
    name_ar,
    type,
    parentCode,
    level = 2,
    initial_balance = 0,
    system_binding = "none",
    currency = "EGP",
  ) {
    if (this.state.accounts.some((a) => a.code === code))
      throw new Error("كود الحساب موجود بالفعل");
    const account = {
      code,
      name_ar,
      type,
      balance: initial_balance,
      parent_code: parentCode,
      level,
      status: "active",
      initial_balance,
      system_binding,
      currency,
      sync_status: system_binding && system_binding !== "none" ? "pending" : "synced",
    };
    this.state.accounts.push(account);
    this.recalculateAccountBalances();
    this.saveState();
    this.logAction(
      "ADMIN",
      "إضافة حساب محاسبي",
      `تم تسجيل الحساب الجديد في الدليل: ${name_ar} (${code})`,
      "CREATE",
    );
    return account;
  }
  updateAccountStatus(code, status) {
    const acc = this.state.accounts.find((a) => a.code === code);
    if (acc) {
      acc.status = status;
      this.saveState();
      this.logAction(
        "ADMIN",
        "تحديث حالة حساب",
        `تم تغيير حالة حساب ${acc.name_ar} إلى ${status}`,
        "UPDATE",
      );
    }
  }
  updateAccount(code, payload) {
    const acc = this.state.accounts.find((a) => a.code === code);
    if (!acc) throw new Error("الحساب غير موجود");
    if (payload.code && payload.code !== code) {
      if (this.state.accounts.some((a) => a.code === payload.code))
        throw new Error("كود الحساب الجديد مستخدم بالفعل لحساب آخر");
      this.state.accounts.forEach((a) => {
        if (a.parent_code === code) a.parent_code = payload.code;
      });
      this.state.journalEntries.forEach((je) => {
        je.lines?.forEach((l) => {
          if (l.account_code === code) l.account_code = payload.code;
        });
      });
    }
    const oldBinding = acc.system_binding;
    Object.assign(acc, payload);
    if (payload.system_binding !== void 0 && payload.system_binding !== oldBinding)
      acc.sync_status = payload.system_binding !== "none" ? "pending" : "synced";
    this.recalculateAccountBalances();
    this.saveState();
    this.logAction(
      "ADMIN",
      "تعديل حساب محاسبي",
      `تم تعديل بيانات الحساب المحاسبي: ${acc.name_ar} (${acc.code})`,
      "UPDATE",
    );
    return acc;
  }
  activateAccountSync(code) {
    const acc = this.state.accounts.find((a) => a.code === code);
    if (acc) {
      acc.sync_status = "synced";
      this.recalculateAccountBalances();
      this.saveState();
      this.logAction(
        "ADMIN",
        "تنشيط مزامنة رصيد الحساب",
        `تم تنشيط مزامنة الرصيد وتحديثه للحساب: ${acc.name_ar} (${acc.code})`,
        "UPDATE",
      );
    }
  }
  deleteAccount(code) {
    const index = this.state.accounts.findIndex((a) => a.code === code);
    if (index === -1) throw new Error("الحساب غير موجود");
    const acc = this.state.accounts[index];
    if (this.state.accounts.some((a) => a.parent_code === code))
      throw new Error(
        "لا يمكن حذف حساب رئيسي يمتلك حسابات فرعية. قم بحذف أو نقل الحسابات الفرعية أولاً.",
      );
    if (this.state.journalEntries.some((je) => je.lines?.some((l) => l.account_code === code))) {
      acc.status = "inactive";
      this.saveState();
      this.logAction(
        "ADMIN",
        "تعطيل حساب مرتبط بقيود",
        `الحساب ${acc.name_ar} (${acc.code}) مرتبط بقيود محاسبية، تم تحويل حالته إلى معطل بدلاً من الحذف الفيزيائي لحفظ الشجرة والنزاهة المالية.`,
        "UPDATE",
      );
      return {
        softDeleted: true,
        message: "الحساب مرتبط بقيود محاسبية، تم تعطيله بدلاً من الحذف لحفظ النزاهة المالية.",
      };
    }
    this.state.accounts.splice(index, 1);
    this.saveState();
    this.logAction(
      "ADMIN",
      "حذف حساب محاسبي",
      `تم حذف الحساب المحاسبي من الدليل: ${acc.name_ar} (${code})`,
      "DELETE",
    );
    return {
      softDeleted: false,
      message: "تم حذف الحساب بنجاح!",
    };
  }
  recalculateAccountBalances() {
    this.enrichJournalEntriesWithDetails();
    const allJournalLines: any[] = [];
    (this.state.journalEntries || []).forEach((entry) =>
      (entry.lines || []).forEach((line) => allJournalLines.push(line)),
    );
    this.ensureJournalAccounts(allJournalLines, "EGP");

    const accountMap = new Map<string, any>();
    const balanceMap: Record<string, number> = {};

    (this.state.accounts || []).forEach((acc) => {
      accountMap.set(acc.code, acc);
      balanceMap[acc.code] = acc.initial_balance || 0;
    });

    (this.state.journalEntries || []).forEach((entry) => {
      if (!entry.lines) return;
      entry.lines.forEach((line) => {
        const acc = accountMap.get(line.account_code);
        if (acc) {
          const debit = Number(line.debit || 0);
          const credit = Number(line.credit || 0);
          if (acc.type === "asset" || acc.type === "expense")
            balanceMap[acc.code] += debit - credit;
          else balanceMap[acc.code] += credit - debit;
        }
      });
    });

    // General Ledger is the accounting source of truth for system-bound accounts and all chart of accounts.
    (this.state.accounts || []).forEach((acc) => {
      acc.balance = balanceMap[acc.code] ?? acc.initial_balance ?? 0;
      if (acc.system_binding && acc.system_binding !== "none" && acc.sync_status !== "pending") {
        acc.sync_status = "synced";
      }
    });

    // Rollup parent account balances (Level 3, Level 2, Level 1) from child account balances
    const parentCodes = new Set(
      (this.state.accounts || []).map((a) => a.parent_code).filter(Boolean),
    );

    const sortedAccountsByLevelDesc = [...(this.state.accounts || [])].sort(
      (a, b) => (Number(b.level) || 4) - (Number(a.level) || 4),
    );

    sortedAccountsByLevelDesc.forEach((acc) => {
      if (parentCodes.has(acc.code)) {
        const directChildren = (this.state.accounts || []).filter(
          (c) => c.parent_code === acc.code,
        );
        if (directChildren.length > 0) {
          acc.balance = directChildren.reduce((sum, c) => sum + Number(c.balance || 0), 0);
        }
      }
    });

    if (this.state.treasuries && this.state.treasuries.length > 0) {
      this.state.treasuries.forEach((tr) => {
        const opening = Number(tr.opening_balance || 0);
        const matchedCode = String(tr.account_code || "").trim();
        const linkedAccount = this.state.accounts?.find(
          (a) => a.code && String(a.code).trim() === matchedCode,
        );

        // Real-time calculation of treasury balance directly from General Ledger Journal Entries
        let totalDebit = 0;
        let totalCredit = 0;

        (this.state.journalEntries || []).forEach((je) => {
          (je.lines || []).forEach((line) => {
            const lineAccCode = String(line.account_code || "").trim();
            let isMatch = false;

            if (matchedCode && lineAccCode === matchedCode) {
              isMatch = true;
            } else {
              const resolved = this.resolveTreasuryForAccount(
                lineAccCode,
                line.currency || je.currency,
                line.description || je.description,
              );
              if (resolved && resolved.id === tr.id) {
                isMatch = true;
              }
            }

            if (isMatch) {
              totalDebit += Number(line.debit || 0);
              totalCredit += Number(line.credit || 0);
            }
          });
        });

        const glCalculatedBalance = opening + (totalDebit - totalCredit);

        // General Ledger account balance is the primary source of truth if available
        let finalBalance = glCalculatedBalance;
        if (matchedCode && balanceMap[matchedCode] !== undefined) {
          const accBal = balanceMap[matchedCode];
          if (accBal !== 0 || glCalculatedBalance === 0) {
            finalBalance = accBal;
          }
        } else if (linkedAccount && linkedAccount.balance !== undefined) {
          if (linkedAccount.balance !== 0 || glCalculatedBalance === 0) {
            finalBalance = linkedAccount.balance;
          }
        }

        tr.balance = finalBalance;
        tr.available_balance = finalBalance;

        // Update multi-currency sub-containers if any
        if (tr.containers && tr.containers.length > 0) {
          // 1. Group containers by currency
          const containersByCurr: Record<string, typeof tr.containers> = {};
          tr.containers.forEach((cnt) => {
            const curr = (cnt.currency || "EGP").toUpperCase();
            if (!containersByCurr[curr]) containersByCurr[curr] = [];
            containersByCurr[curr].push(cnt);
          });

          // 2. For each currency, calculate GL total and individual container transaction totals
          Object.entries(containersByCurr).forEach(([curr, cntList]) => {
            let glDebit = 0;
            let glCredit = 0;

            (this.state.journalEntries || []).forEach((je) => {
              (je.lines || []).forEach((line) => {
                const lineAccCode = String(line.account_code || "").trim();
                const lineCurr = (line.currency || je.currency || "").toUpperCase();

                if (lineCurr === curr) {
                  let isMatch = false;

                  if (matchedCode && lineAccCode === matchedCode) {
                    isMatch = true;
                  } else {
                    const resolved = this.resolveTreasuryForAccount(
                      lineAccCode,
                      line.currency || je.currency,
                      line.description || je.description,
                    );
                    if (resolved && resolved.id === tr.id) {
                      isMatch = true;
                    }
                  }

                  if (isMatch) {
                    glDebit += Number(line.debit || 0);
                    glCredit += Number(line.credit || 0);
                  }
                }
              });
            });

            const glCurrBal = glDebit - glCredit;

            let totalCntBal = 0;
            cntList.forEach((cnt) => {
              const opening = Number((cnt as any).opening_balance || 0);
              let cntTxNet = 0;

              (this.state.treasuryTransactions || []).forEach((tx) => {
                if (tx.treasury_id === tr.id) {
                  let matches = false;
                  if (tx.container_id) {
                    matches = tx.container_id === cnt.id;
                  } else {
                    const txCurr = (tx.currency || "").toUpperCase();
                    if (txCurr === curr) {
                      const method = (tx.payment_method || "cash").toLowerCase();
                      const cntId = cnt.id.toLowerCase();
                      const cntName = cnt.name.toLowerCase();
                      if (cntId.includes("cash") || cntName.includes("كاش")) {
                        matches = method === "cash";
                      } else if (
                        cntId.includes("card") ||
                        cntName.includes("فيزا") ||
                        cntName.includes("شبكة")
                      ) {
                        matches = method === "card" || method === "visa";
                      } else if (cntId.includes("wallet") || cntName.includes("محفظة")) {
                        matches = method === "wallet" || method === "bank_transfer";
                      } else {
                        matches = true;
                      }
                    }
                  }

                  if (matches) {
                    const amt = Number(tx.amount || 0);
                    if (["deposit", "sales", "transfer_in"].includes(tx.type)) {
                      cntTxNet += amt;
                    } else if (["withdrawal", "expense", "transfer_out"].includes(tx.type)) {
                      cntTxNet -= amt;
                    }
                  }
                }
              });

              cnt.balance = opening + cntTxNet;
              totalCntBal += cnt.balance;
            });

            const diff = glCurrBal - totalCntBal;
            if (diff !== 0 && cntList.length > 0) {
              const primaryCnt =
                cntList.find((c) => c.id.includes("cash") || c.name.includes("كاش")) || cntList[0];
              primaryCnt.balance += diff;
            }
          });

          // For multi-currency treasuries (e.g. tr-1), if container balances exist, reflect primary container balance
          const egpCnt = tr.containers.find((c) => c.currency === "EGP");
          if (tr.currency === "MULTI" && egpCnt && egpCnt.balance !== 0 && tr.balance === 0) {
            tr.balance = egpCnt.balance;
            tr.available_balance = egpCnt.balance;
          }
        }
      });
    }
    this.saveState();
  }
  resolveTreasuryForAccount(accountCode, currency, movementNote) {
    if (!this.state.treasuries || this.state.treasuries.length === 0) return void 0;
    const code = String(accountCode || "").trim();
    if (!code) return void 0;

    const directMatch = this.state.treasuries.find(
      (t) => !t.deleted && t.account_code && String(t.account_code).trim() === code,
    );
    if (directMatch) return directMatch;

    const curr = (currency || "").toUpperCase();
    const note = (movementNote || "").toLowerCase();

    // Check if account is a cash or bank asset account
    const isCashOrBankCode =
      code.startsWith("1301") ||
      code.startsWith("1302") ||
      code.startsWith("1303") ||
      code.startsWith("1501") ||
      code.startsWith("1502") ||
      code.startsWith("1010") ||
      code.startsWith("1020");

    const acc = this.state.accounts?.find((a) => a.code === code);
    const isCashOrBankAcc = acc
      ? acc.type === "asset" &&
        (acc.sub_type === "cash" ||
          acc.sub_type === "bank" ||
          acc.name_ar.includes("خزين") ||
          acc.name_ar.includes("صندوق") ||
          acc.name_ar.includes("بنك"))
      : false;

    // Do NOT resolve non-cash/bank accounts (expenses, revenues, payables, receivables, etc.) to treasuries
    if (
      !isCashOrBankCode &&
      !isCashOrBankAcc &&
      !note.includes("خزين") &&
      !note.includes("صندوق") &&
      !note.includes("بنك")
    ) {
      return void 0;
    }

    if (code === "15010100" || code === "150101" || code.startsWith("150101")) {
      const usdTr = this.state.treasuries.find(
        (t) => !t.deleted && (t.id === "tr-4" || (t.currency === "USD" && t.type === "cash")),
      );
      if (usdTr) return usdTr;
    }
    if (code === "15010200" || code === "150102" || (code.startsWith("1501") && curr === "EGP")) {
      const egpTr = this.state.treasuries.find(
        (t) =>
          !t.deleted && (t.id === "tr-5" || (t.currency === "EGP" && t.name_ar.includes("مصري"))),
      );
      if (egpTr) return egpTr;
    }
    if (code === "101000" || code === "1010" || code.startsWith("101000")) {
      if (curr === "USD") {
        const usdTr = this.state.treasuries.find((t) => !t.deleted && t.currency === "USD");
        if (usdTr) return usdTr;
      } else if (curr === "SSP") {
        const sspTr = this.state.treasuries.find((t) => !t.deleted && t.currency === "SSP");
        if (sspTr) return sspTr;
      }
      const cashierTr = this.state.treasuries.find(
        (t) => !t.deleted && (t.id === "tr-1" || t.linked_to_restaurant),
      );
      if (cashierTr) return cashierTr;
    }
    if (code === "101001" || code.includes("juba") || note.includes("جوبا")) {
      const jubaTr = this.state.treasuries.find(
        (t) =>
          !t.deleted &&
          (t.id === "tr-juba" || t.branch_id === "branch-2" || t.name_ar.includes("جوبا")),
      );
      if (jubaTr) return jubaTr;
    }
    if (
      code === "102000" ||
      code.startsWith("1502") ||
      code.startsWith("1020") ||
      note.includes("بنك") ||
      note.includes("cib")
    ) {
      const bankTr = this.state.treasuries.find(
        (t) => !t.deleted && (t.type === "bank" || t.id === "tr-2" || t.id === "tr-cib"),
      );
      if (bankTr) return bankTr;
    }
    if (acc) {
      const accName = acc.name_ar.toLowerCase();
      if (accName.includes("دولار") || accName.includes("usd")) {
        const t = this.state.treasuries.find((tr) => !tr.deleted && tr.currency === "USD");
        if (t) return t;
      }
      if (accName.includes("بنك") || accName.includes("cib") || accName.includes("ايدين")) {
        const t = this.state.treasuries.find((tr) => !tr.deleted && tr.type === "bank");
        if (t) return t;
      }
      if (accName.includes("كاشير") || accName.includes("صالة") || accName.includes("مطعم")) {
        const t = this.state.treasuries.find(
          (tr) => !tr.deleted && (tr.id === "tr-1" || tr.linked_to_restaurant),
        );
        if (t) return t;
      }
      if (accName.includes("مصري") || accName.includes("ادارة") || accName.includes("إدارة")) {
        const t = this.state.treasuries.find(
          (tr) => !tr.deleted && (tr.id === "tr-5" || tr.currency === "EGP"),
        );
        if (t) return t;
      }
    }
    if (curr) {
      const fallbackByCurr = this.state.treasuries.find((t) => !t.deleted && t.currency === curr);
      if (fallbackByCurr) return fallbackByCurr;
    }
    return (
      this.state.treasuries.find(
        (t) => !t.deleted && (t.id === "tr-1" || t.linked_to_restaurant),
      ) || this.state.treasuries.find((t) => !t.deleted)
    );
  }
  inferMovementTypeFromLine(line, mainDesc = "", otherLines = []) {
    const isDebit = Number(line.debit || 0) > 0;
    const isCredit = Number(line.credit || 0) > 0;
    const desc = (line.description || " " + mainDesc).toLowerCase();
    const hasRevenueAccount = otherLines.some((l) => l.account_code.startsWith("4"));
    const hasExpenseAccount = otherLines.some(
      (l) =>
        l.account_code.startsWith("5") ||
        l.account_code.startsWith("6") ||
        l.account_code.startsWith("3"),
    );
    const hasTreasuryAccount = otherLines.some(
      (l) =>
        l.account_code.startsWith("1501") ||
        l.account_code.startsWith("1010") ||
        l.account_code.startsWith("1020"),
    );
    const hasSupplierOrInv = otherLines.some(
      (l) =>
        l.account_code.startsWith("103") ||
        l.account_code.startsWith("202") ||
        l.account_code.startsWith("140"),
    );
    if (isDebit) {
      if (desc.includes("تحويل") || desc.includes("تمويل") || hasTreasuryAccount)
        return "transfer_in";
      if (
        desc.includes("مبيعات") ||
        desc.includes("ايراد") ||
        desc.includes("إيراد") ||
        hasRevenueAccount
      )
        return "sales";
      if (desc.includes("تسوية") || desc.includes("فارق")) return "reconciliation";
      return "deposit";
    }
    if (isCredit) {
      if (desc.includes("تحويل") || desc.includes("تمويل") || hasTreasuryAccount)
        return "transfer_out";
      if (
        desc.includes("شراء") ||
        desc.includes("مشتريات") ||
        desc.includes("خامات") ||
        hasSupplierOrInv
      )
        return "purchase";
      if (
        desc.includes("مصروف") ||
        desc.includes("مرتب") ||
        desc.includes("اجور") ||
        desc.includes("أجور") ||
        desc.includes("بنزين") ||
        desc.includes("صيانة") ||
        desc.includes("بوفيه") ||
        desc.includes("ايجار") ||
        desc.includes("إيجار") ||
        desc.includes("سلف") ||
        hasExpenseAccount
      )
        return "expense";
      if (desc.includes("تسوية") || desc.includes("عجز")) return "reconciliation";
      return "withdrawal";
    }
    return "deposit";
  }
  importJournalEntriesAndSyncTreasuries(entries, options = {}) {
    let insertedEntries = 0;
    let newAccountsCreated = 0;
    let linkedTreasuryTransactions = 0;

    const existingEntryIds = new Set(this.state.journalEntries.map((je) => je.id));
    const existingEntryRefs = new Set(
      this.state.journalEntries.map(
        (je) => `${je.reference || ""}_${je.date || ""}_${je.description || ""}`,
      ),
    );
    const existingAccountCodes = new Set(this.state.accounts.map((a) => a.code));
    const existingTxIds = new Set(this.state.treasuryTransactions.map((tx) => tx.id));
    const existingTxRefs = new Set(
      this.state.treasuryTransactions.map(
        (tx) => `${tx.related_entity_id || ""}_${tx.treasury_id}_${tx.amount}_${tx.type}`,
      ),
    );
    (entries || []).forEach((entry) => {
      const entryKey = `${entry.reference || ""}_${entry.date || ""}_${entry.description || ""}`;
      let entryToProcess = entry;
      if (!existingEntryIds.has(entry.id) && !existingEntryRefs.has(entryKey)) {
        this.state.journalEntries.unshift(entry);
        existingEntryIds.add(entry.id);
        existingEntryRefs.add(entryKey);
        insertedEntries++;
      } else {
        const found = this.state.journalEntries.find(
          (j) =>
            j.id === entry.id ||
            `${j.reference || ""}_${j.date || ""}_${j.description || ""}` === entryKey,
        );
        if (found) entryToProcess = found;
      }
      (entryToProcess.lines || []).forEach((line, lineIndex) => {
        const code = String(line.account_code || "").trim();
        if (!code) return;
        if (!existingAccountCodes.has(code)) {
          let type = "asset";
          if (code.startsWith("1")) type = "asset";
          else if (code.startsWith("2")) type = "liability";
          else if (code.startsWith("3")) type = "equity";
          else if (code.startsWith("4")) type = "revenue";
          else if (code.startsWith("5") || code.startsWith("6")) type = "expense";
          let level = 3;
          if (code.length <= 1) level = 1;
          else if (code.length <= 3) level = 2;
          else if (code.length <= 5) level = 3;
          else level = 4;
          const accDisplayName =
            (line.account_name && line.account_name.trim()) ||
            (line.description && !line.description.startsWith("قيد")
              ? line.description
              : `حساب محاسبي (${code})`);
          const newAcc = {
            code,
            name_ar: accDisplayName,
            type,
            level,
            balance: 0,
            initial_balance: 0,
            status: "active",
            currency: line.currency || entryToProcess.currency || "EGP",
            system_binding: "none",
          };
          this.state.accounts.push(newAcc);
          existingAccountCodes.add(code);
          newAccountsCreated++;
        }
        const isTreasuryAccount =
          code.startsWith("130") ||
          code.startsWith("1501") ||
          code.startsWith("1010") ||
          code.startsWith("1502") ||
          code.startsWith("1020") ||
          this.state.treasuries.some((t) => t.account_code === code);
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        const amount = debit > 0 ? debit : credit;
        if (isTreasuryAccount && amount > 0) {
          const matchedTreasury = this.resolveTreasuryForAccount(
            code,
            line.currency || entryToProcess.currency,
            line.description || entryToProcess.description,
          );
          if (matchedTreasury) {
            const otherLines = (entryToProcess.lines || []).filter((_, idx) => idx !== lineIndex);
            const movementType = this.inferMovementTypeFromLine(
              line,
              entryToProcess.description,
              otherLines,
            );
            const txCurrency =
              line.currency || entryToProcess.currency || matchedTreasury.currency || "EGP";
            const txNote =
              line.description ||
              entryToProcess.description ||
              `قيد رقم ${entryToProcess.reference || entryToProcess.id}`;
            const txKey = `${entryToProcess.id}_${matchedTreasury.id}_${amount}_${movementType}`;
            if (!existingTxRefs.has(txKey)) {
              const txId = `tx-import-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;
              const txDate = entryToProcess.date
                ? new Date(entryToProcess.date).toISOString()
                : /* @__PURE__ */ new Date().toISOString();
              const newTx = {
                id: txId,
                branch_id: matchedTreasury.branch_id || "branch-1",
                treasury_id: matchedTreasury.id,
                type: movementType,
                amount,
                currency: txCurrency,
                payment_method: matchedTreasury.type === "bank" ? "bank_transfer" : "cash",
                note: txNote,
                related_entity_id: entryToProcess.id,
                created_at: txDate,
              };
              this.state.treasuryTransactions.unshift(newTx);
              existingTxIds.add(txId);
              existingTxRefs.add(txKey);
              linkedTreasuryTransactions++;
            }
          }
        }
      });
    });
    this.recalculateAccountBalances();
    this.saveState();
    this.logAction(
      "ADMIN",
      "استيراد ومعالجة قيود Excel",
      `تم استيراد ومعالجة ${insertedEntries} قيد، وإنشاء ${newAccountsCreated} حساب جديد، وربط ${linkedTreasuryTransactions} حركة بالخزائن المقابلة.`,
      "IMPORT",
    );
    return {
      insertedEntries,
      newAccountsCreated,
      linkedTreasuryTransactions,
    };
  }
  mergeAndSyncAllData() {
    const existingAccountCodes = new Set(this.state.accounts.map((a) => a.code));
    let newAccountsCreated = 0;
    this.state.journalEntries.forEach((entry) => {
      (entry.lines || []).forEach((line) => {
        const code = String(line.account_code || "").trim();
        if (code && !existingAccountCodes.has(code)) {
          let type = "asset";
          if (code.startsWith("1")) type = "asset";
          else if (code.startsWith("2")) type = "liability";
          else if (code.startsWith("3")) type = "equity";
          else if (code.startsWith("4")) type = "revenue";
          else if (code.startsWith("5") || code.startsWith("6")) type = "expense";
          let level = 3;
          if (code.length <= 1) level = 1;
          else if (code.length <= 3) level = 2;
          else if (code.length <= 5) level = 3;
          else level = 4;
          this.state.accounts.push({
            code,
            name_ar: line.description
              ? `حساب (${code}) - ${line.description}`
              : `حساب محاسبي (${code})`,
            type,
            level,
            balance: 0,
            initial_balance: 0,
            status: "active",
            currency: line.currency || entry.currency || "EGP",
            system_binding: "none",
          });
          existingAccountCodes.add(code);
          newAccountsCreated++;
        }
      });
    });
    const existingTxRefs = new Set(
      (this.state.treasuryTransactions || []).map(
        (tx) => `${tx.related_entity_id || ""}_${tx.treasury_id}_${tx.amount}_${tx.type}`,
      ),
    );
    this.state.journalEntries.forEach((entry) => {
      (entry.lines || []).forEach((line, idx) => {
        const code = String(line.account_code || "").trim();
        const isTreasuryAccount =
          code.startsWith("130") ||
          code.startsWith("1501") ||
          code.startsWith("1010") ||
          code.startsWith("1502") ||
          code.startsWith("1020") ||
          this.state.treasuries.some((t) => t.account_code === code);
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        const amount = debit > 0 ? debit : credit;
        if (isTreasuryAccount && amount > 0) {
          const matchedTreasury = this.resolveTreasuryForAccount(
            code,
            line.currency || entry.currency,
            line.description || entry.description,
          );
          if (matchedTreasury) {
            const otherLines = (entry.lines || []).filter((_, i) => i !== idx);
            const movementType = this.inferMovementTypeFromLine(
              line,
              entry.description,
              otherLines,
            );
            const txKey = `${entry.id}_${matchedTreasury.id}_${amount}_${movementType}`;
            if (!existingTxRefs.has(txKey)) {
              const newTx = {
                id: `tx-sync-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
                branch_id: matchedTreasury.branch_id || "branch-1",
                treasury_id: matchedTreasury.id,
                type: movementType,
                amount,
                currency: line.currency || entry.currency || matchedTreasury.currency || "EGP",
                payment_method: matchedTreasury.type === "bank" ? "bank_transfer" : "cash",
                note:
                  line.description || entry.description || `قيد رقم ${entry.reference || entry.id}`,
                related_entity_id: entry.id,
                created_at: entry.date
                  ? new Date(entry.date).toISOString()
                  : /* @__PURE__ */ new Date().toISOString(),
              };
              this.state.treasuryTransactions.unshift(newTx);
              existingTxRefs.add(txKey);
            }
          }
        }
      });
    });
    this.recalculateAccountBalances();
    this.saveState();
    this.logAction(
      "ADMIN",
      "دمج وتحديث البيانات المالية",
      `تم فحص ومطابقة شجرة الحسابات (${this.state.accounts.length} حساب) والقيود (${this.state.journalEntries.length} قيد) وتحديث كافة الخزائن والأرصدة.`,
      "UPDATE",
    );
    return {
      accountsCount: this.state.accounts.length,
      entriesCount: this.state.journalEntries.length,
      treasuriesUpdated: this.state.treasuries.length,
      transactionsCount: this.state.treasuryTransactions.length,
    };
  }

  persistAllJournalsToDatabase() {
    const existingAccountCodes = new Set(this.state.accounts.map((a) => a.code));
    const newlyCreatedAccounts: Account[] = [];
    let newAccountsCreated = 0;

    // 1. Ensure all accounts in all journal lines exist
    this.state.journalEntries.forEach((entry) => {
      (entry.lines || []).forEach((line) => {
        const code = String(line.account_code || "").trim();
        if (code && !existingAccountCodes.has(code)) {
          let type = "asset";
          if (code.startsWith("1")) type = "asset";
          else if (code.startsWith("2")) type = "liability";
          else if (code.startsWith("3")) type = "equity";
          else if (code.startsWith("4")) type = "revenue";
          else if (code.startsWith("5") || code.startsWith("6")) type = "expense";

          let level = 3;
          if (code.length <= 1) level = 1;
          else if (code.length <= 3) level = 2;
          else if (code.length <= 5) level = 3;
          else level = 4;

          const newAcc: Account = {
            code,
            name_ar:
              (line.account_name && line.account_name.trim()) ||
              (line.description && !line.description.startsWith("قيد")
                ? line.description
                : `حساب محاسبي (${code})`),
            type,
            level,
            balance: 0,
            initial_balance: 0,
            status: "active",
            currency: line.currency || entry.currency || "USD",
            system_binding: "none",
          };
          this.state.accounts.push(newAcc);
          newlyCreatedAccounts.push(newAcc);
          existingAccountCodes.add(code);
          newAccountsCreated++;
        }
      });
    });

    // 2. Link & Sync Treasury movements
    const existingTxRefs = new Set(
      (this.state.treasuryTransactions || []).map(
        (tx) => `${tx.related_entity_id || ""}_${tx.treasury_id}_${tx.amount}_${tx.type}`,
      ),
    );
    let linkedTreasuryTransactions = 0;

    this.state.journalEntries.forEach((entry) => {
      (entry.lines || []).forEach((line, idx) => {
        const code = String(line.account_code || "").trim();
        const isTreasuryAccount =
          code.startsWith("130") ||
          code.startsWith("1501") ||
          code.startsWith("1010") ||
          code.startsWith("1502") ||
          code.startsWith("1020") ||
          this.state.treasuries.some((t) => t.account_code === code);
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        const amount = debit > 0 ? debit : credit;

        if (isTreasuryAccount && amount > 0) {
          const matchedTreasury = this.resolveTreasuryForAccount(
            code,
            line.currency || entry.currency,
            line.description || entry.description,
          );
          if (matchedTreasury) {
            const otherLines = (entry.lines || []).filter((_, i) => i !== idx);
            const movementType = this.inferMovementTypeFromLine(
              line,
              entry.description,
              otherLines,
            );
            const txKey = `${entry.id}_${matchedTreasury.id}_${amount}_${movementType}`;
            if (!existingTxRefs.has(txKey)) {
              const newTx = {
                id: `tx-sync-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
                branch_id: matchedTreasury.branch_id || "branch-1",
                treasury_id: matchedTreasury.id,
                type: movementType,
                amount,
                currency: line.currency || entry.currency || matchedTreasury.currency || "USD",
                payment_method: matchedTreasury.type === "bank" ? "bank_transfer" : "cash",
                note:
                  line.description || entry.description || `قيد رقم ${entry.reference || entry.id}`,
                related_entity_id: entry.id,
                created_at: entry.date
                  ? new Date(entry.date).toISOString()
                  : /* @__PURE__ */ new Date().toISOString(),
              };
              this.state.treasuryTransactions.unshift(newTx);
              existingTxRefs.add(txKey);
              linkedTreasuryTransactions++;
            }
          }
        }
      });
    });

    // 3. Recalculate balances
    this.recalculateAccountBalances();

    // 4. Calculate stats for report
    let totalBaseUSD = 0;
    let balancedEntriesCount = 0;
    let unbalancedEntriesCount = 0;

    this.state.journalEntries.forEach((je) => {
      const entryCurrencies = Array.from(
        new Set(je.lines.map((l) => l.currency || je.currency || "USD")),
      );
      const isSingleCurr = entryCurrencies.length <= 1;

      const tDebit = je.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
      const tCredit = je.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

      const baseDebit = je.lines.reduce((s, l) => {
        const r = Number(l.rate) || 1;
        const v = Number(l.debit) || 0;
        if (l.currency === "USD") return s + v;
        return s + v * r;
      }, 0);

      const baseCredit = je.lines.reduce((s, l) => {
        const r = Number(l.rate) || 1;
        const v = Number(l.credit) || 0;
        if (l.currency === "USD") return s + v;
        return s + v * r;
      }, 0);

      totalBaseUSD += baseDebit;

      const isBalanced = isSingleCurr
        ? Math.abs(tDebit - tCredit) < 0.01
        : Math.abs(baseDebit - baseCredit) < 0.05;
      if (isBalanced) balancedEntriesCount++;
      else unbalancedEntriesCount++;
    });

    // 5. Commit to durable storage
    this.saveState();
    this.logAction(
      "ADMIN",
      "حفظ وتثبيت القيود في قاعدة البيانات",
      `تم حفظ وتثبيت ${this.state.journalEntries.length} قيد محاسبي (${balancedEntriesCount} متزن، ${unbalancedEntriesCount} غير متزن)، وإنشاء ${newAccountsCreated} حساب جديد، وربط ${linkedTreasuryTransactions} حركة خزينة.`,
      "UPDATE",
    );

    return {
      success: true,
      savedEntriesCount: this.state.journalEntries.length,
      savedEntries: [...this.state.journalEntries],
      newAccountsCreated,
      newlyCreatedAccounts,
      totalAccountsCount: this.state.accounts.length,
      linkedTreasuryTransactions,
      totalBaseUSD,
      balancedEntriesCount,
      unbalancedEntriesCount,
      savedAt: new Date().toLocaleTimeString("ar-EG", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };
  }

  checkCanModifyJournalEntry(entryDateOrEntry: any): { allowed: boolean; reason?: string } {
    const dateStr =
      typeof entryDateOrEntry === "string" ? entryDateOrEntry : entryDateOrEntry?.date;
    const currentYear = new Date().getFullYear(); // 2026
    let entryYear = currentYear;
    if (dateStr) {
      const parsedYear = new Date(dateStr).getFullYear();
      if (!isNaN(parsedYear) && parsedYear > 1970) {
        entryYear = parsedYear;
      }
    }

    // Previous years restriction check (e.g. 2025, 2024, etc.)
    if (entryYear < currentYear) {
      if (this.state.isAccountingPeriodLocked) {
        return {
          allowed: false,
          reason:
            "You cannot edit restrictions in a closed year. (لا يمكنك تعديل أو حذف القيود في سنة أو فترة مالية مغلقة)",
        };
      }
    } else if (entryYear === currentYear) {
      // Current fiscal year check (e.g. 2026)
      if (this.state.fiscalYearStatus === "closed") {
        return {
          allowed: false,
          reason:
            "السنة المالية 2026 مغلقة ومقفلة حالياً، لا يمكن تعديل أو حذف القيود إلا بعد إعادة فتح السنة المالية.",
        };
      }
    }

    return { allowed: true };
  }

  deleteSingleJournalEntry(entryId: string): { success: boolean; error?: string } {
    const targetEntry = this.state.journalEntries.find((je) => je.id === entryId);
    if (!targetEntry) return { success: false, error: "القيد غير موجود" };

    const check = this.checkCanModifyJournalEntry(targetEntry.date);
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    this.state.journalEntries = this.state.journalEntries.filter((je) => je.id !== entryId);
    if (Array.isArray(this.state.treasuryTransactions)) {
      this.state.treasuryTransactions = this.state.treasuryTransactions.filter(
        (tx) => tx.related_entity_id !== entryId,
      );
    }
    this.recalculateAccountBalances();
    this.saveState();
    this.logAction(
      "ADMIN",
      "حذف قيد محاسبي فردي",
      `تم حذف القيد رقم ${targetEntry.reference || targetEntry.id} (${targetEntry.description}) وإعادة احتساب الأرصدة.`,
      "DELETE",
    );
    this.notify();
    return { success: true };
  }

  updateExistingJournalEntry(
    entryId: string,
    updated: {
      description?: string;
      date?: string;
      reference?: string;
      currency?: string;
      lines?: any[];
    },
  ): { success: boolean; error?: string } {
    const targetEntry = this.state.journalEntries.find((je) => je.id === entryId);
    if (!targetEntry) return { success: false, error: "القيد غير موجود" };

    const check = this.checkCanModifyJournalEntry(targetEntry.date);
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    if (updated.date && updated.date !== targetEntry.date) {
      const newDateCheck = this.checkCanModifyJournalEntry(updated.date);
      if (!newDateCheck.allowed) {
        return { success: false, error: newDateCheck.reason };
      }
    }

    if (updated.description !== undefined) targetEntry.description = updated.description;
    if (updated.date !== undefined) targetEntry.date = updated.date;
    if (updated.reference !== undefined) targetEntry.reference = updated.reference;
    if (updated.currency !== undefined) targetEntry.currency = updated.currency;
    if (updated.lines !== undefined) targetEntry.lines = updated.lines;

    this.recalculateAccountBalances();
    this.saveState();
    this.logAction(
      "ADMIN",
      "تعديل قيد محاسبي",
      `تم تعديل القيد المحاسبي رقم ${targetEntry.reference || targetEntry.id} (${targetEntry.description}) بنجاح.`,
      "UPDATE",
    );
    this.notify();
    return { success: true };
  }

  getAccountName(accountCode: string): string {
    const acc = (this.state.accounts || []).find((a) => a.code === accountCode);
    return acc ? acc.name_ar : accountCode;
  }

  updateJournalEntryAttachments(entryId: string, attachments: any[]) {
    const entry = (this.state.journalEntries || []).find(
      (e) => e.id === entryId || e.reference === entryId,
    );
    if (entry) {
      entry.attachments = [...(entry.attachments || []), ...attachments];
      this.saveState();
      this.notify();
    }
  }

  async syncWithCloud(): Promise<boolean> {
    this.saveState();
    this.notify();
    return true;
  }

  getAccountLedgerEntries(accountCode) {
    const entries = [];
    const acc = this.state.accounts.find((a) => a.code === accountCode);
    if (!acc)
      return {
        account: null,
        entries: [],
      };
    let currentBalance = acc.initial_balance || 0;
    const sortedEntries = [...this.state.journalEntries].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    for (const je of sortedEntries)
      for (const line of je.lines || [])
        if (line.account_code === accountCode) {
          const debit = Number(line.debit || 0);
          const credit = Number(line.credit || 0);
          if (acc.type === "asset" || acc.type === "expense") currentBalance += debit - credit;
          else currentBalance += credit - debit;
          entries.push({
            id: je.id,
            date: je.date,
            description: je.description,
            reference: je.reference,
            debit,
            credit,
            runningBalance: currentBalance,
            created_by: je.created_by,
          });
        }
    return {
      account: acc,
      entries,
    };
  }
  getLineBaseValue(amount, rate, currency = "USD") {
    const val = Number(amount) || 0;
    const r = Number(rate) || 1;
    const curr = currency || "USD";
    if (curr === "USD" || r <= 0) return val;
    return val / r;
  }

  getExchangeRate(currency?: string): number {
    const curr = String(currency || "USD")
      .toUpperCase()
      .trim();
    if (curr === "USD" || !curr) return 1;
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      try {
        const stored = localStorage.getItem("app_exchange_rates");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && typeof parsed[curr] === "number" && parsed[curr] > 0) {
            return Number(parsed[curr]);
          }
        }
      } catch {
        // Ignore fallback error
      }
    }
    if (
      this.state.exchangeRates &&
      typeof this.state.exchangeRates[curr] === "number" &&
      this.state.exchangeRates[curr] > 0
    ) {
      return Number(this.state.exchangeRates[curr]);
    }
    if (curr === "EGP") return 50;
    if (curr === "SSP") return 100;
    return 1;
  }

  generateJournalReference(
    dateStr?: string,
    providedRef?: string,
    pendingEntries: any[] = [],
    periodVal?: any,
    journalNumVal?: any,
  ) {
    // 1. Determine target Year and Month
    let targetYear = new Date().getFullYear();
    let targetMonth = new Date().getMonth() + 1;

    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        targetYear = d.getFullYear();
        targetMonth = d.getMonth() + 1;
      }
    }

    if (periodVal !== undefined && periodVal !== null && String(periodVal).trim() !== "") {
      const pNum = parseInt(String(periodVal).trim(), 10);
      if (!isNaN(pNum) && pNum >= 1 && pNum <= 12) {
        targetMonth = pNum;
      }
    }

    const formattedMonth = String(targetMonth).padStart(2, "0");

    // Helper: Parse MM/NN or M/N or JV-MM/NN reference into period and sequence
    const parseRefSeq = (refStr: string): { p: number; seq: number } | null => {
      if (!refStr) return null;
      const str = String(refStr).trim();
      const match = str.match(/^(?:JV-)?(\d{1,2})\/(\d{1,})$/i);
      if (match) {
        const p = parseInt(match[1], 10);
        const seq = parseInt(match[2], 10);
        if (!isNaN(p) && p >= 1 && p <= 12 && !isNaN(seq) && seq > 0) {
          return { p, seq };
        }
      }
      return null;
    };

    // Helper: Extract entry year and month
    const getEntryYearAndMonth = (je: any): { year: number; month: number } => {
      const dStr = je.date || je.created_at;
      if (dStr) {
        const d = new Date(dStr);
        if (!isNaN(d.getTime())) {
          return { year: d.getFullYear(), month: d.getMonth() + 1 };
        }
      }
      return { year: targetYear, month: targetMonth };
    };

    // Helper: Check if entry is in target year & month
    const isSamePeriod = (je: any) => {
      if (!je) return false;
      const { year, month } = getEntryYearAndMonth(je);
      return year === targetYear && month === targetMonth;
    };

    // Gather existing reference sequences for the same month and year
    const usedSeqs = new Set<number>();
    let maxSeq = 0;

    const scanEntry = (je: any) => {
      if (!je || !je.reference) return;
      if (!isSamePeriod(je)) return;

      const parsed = parseRefSeq(je.reference);
      if (parsed && parsed.p === targetMonth) {
        usedSeqs.add(parsed.seq);
        if (parsed.seq > maxSeq) {
          maxSeq = parsed.seq;
        }
      }
    };

    if (Array.isArray(this.state.journalEntries)) {
      this.state.journalEntries.forEach(scanEntry);
    }
    if (Array.isArray(pendingEntries)) {
      pendingEntries.forEach(scanEntry);
    }

    // 2. If providedRef is explicitly passed in MM/NN format, check if it's usable without duplication
    if (providedRef && String(providedRef).trim()) {
      const parsedProvided = parseRefSeq(providedRef);
      if (parsedProvided && parsedProvided.p === targetMonth) {
        if (!usedSeqs.has(parsedProvided.seq)) {
          const formattedSeq = String(parsedProvided.seq).padStart(2, "0");
          return `${formattedMonth}/${formattedSeq}`;
        }
      }
    }

    // 3. Handle explicit journalNumVal if provided
    if (
      journalNumVal !== undefined &&
      journalNumVal !== null &&
      String(journalNumVal).trim() !== "" &&
      String(journalNumVal).trim() !== "0"
    ) {
      const parsedVal = parseRefSeq(String(journalNumVal));
      if (parsedVal && parsedVal.p === targetMonth) {
        if (!usedSeqs.has(parsedVal.seq)) {
          const formattedSeq = String(parsedVal.seq).padStart(2, "0");
          return `${formattedMonth}/${formattedSeq}`;
        }
      } else {
        const jNum = parseInt(String(journalNumVal).trim(), 10);
        if (!isNaN(jNum) && jNum > 0 && !usedSeqs.has(jNum)) {
          const formattedSeq = String(jNum).padStart(2, "0");
          return `${formattedMonth}/${formattedSeq}`;
        }
      }
    }

    // 4. Determine next sequence (maxSeq + 1, skipping any used numbers)
    let nextSeq = maxSeq + 1;
    while (usedSeqs.has(nextSeq)) {
      nextSeq++;
    }

    const formattedSeq = String(nextSeq).padStart(2, "0");
    return `${formattedMonth}/${formattedSeq}`;
  }

  getCanonicalAccountDefinition(code: string, preferredName?: string) {
    const normalized = String(code || "").trim();
    const current = (this.state.accounts || []).find(
      (account) =>
        String(account.code) === normalized &&
        account.name_ar &&
        !String(account.name_ar).includes("حساب محاسبي"),
    );
    if (current)
      return {
        code: normalized,
        name_ar: current.name_ar,
        type: current.type,
        level: current.level || 4,
        currency: current.currency || "EGP",
      };
    const oracle = ORACLE_MIGRATION_ACCOUNTS.find(
      (account: any) => String(account.code) === normalized,
    );
    if (oracle)
      return {
        code: normalized,
        name_ar: oracle.name_ar,
        type: oracle.type,
        level: oracle.level || 4,
        currency: oracle.currency || "EGP",
      };
    const known: Record<string, { name_ar: string; type: Account["type"] }> = {
      "101000": { name_ar: "الخزائن والنقدية الرئيسية", type: "asset" },
      "101001": { name_ar: "خزائن ونقدية فرع جوبا", type: "asset" },
      "102000": { name_ar: "البنوك والحسابات المصرفية", type: "asset" },
      "103000": { name_ar: "المخزون", type: "asset" },
      "201000": { name_ar: "حسابات الموردين", type: "liability" },
      "201100": { name_ar: "تأمينات مستأجري المحلات", type: "liability" },
      "201200": { name_ar: "دفعات مقدمة من المستأجرين", type: "liability" },
      "202000": { name_ar: "ضرائب مستحقة", type: "liability" },
      "301000": { name_ar: "حساب التمويل ورأس المال", type: "equity" },
      "401000": { name_ar: "إيرادات المبيعات", type: "revenue" },
      "502000": { name_ar: "رواتب وأجور الموظفين", type: "expense" },
      "503000": { name_ar: "إيجارات الفروع", type: "expense" },
      "504000": { name_ar: "الكهرباء والمياه والطاقة", type: "expense" },
      "505000": { name_ar: "التسويق والإعلانات", type: "expense" },
      "506000": { name_ar: "الهدر والمفقودات", type: "expense" },
      "600000": { name_ar: "مصروفات تشغيلية متنوعة", type: "expense" },
    };
    const fallback = known[normalized] || {
      name_ar: preferredName || `حساب ${normalized}`,
      type: normalized.startsWith("4")
        ? "revenue"
        : normalized.startsWith("5") || normalized.startsWith("6")
          ? "expense"
          : normalized.startsWith("2")
            ? "liability"
            : normalized.startsWith("3")
              ? "equity"
              : "asset",
    };
    return {
      code: normalized,
      name_ar: fallback.name_ar,
      type: fallback.type,
      level: normalized.length >= 7 ? 4 : 3,
      currency: "EGP",
    };
  }

  ensureJournalAccounts(lines: any[], defaultCurrency = "EGP") {
    if (!Array.isArray(this.state.accounts)) this.state.accounts = [];
    (lines || []).forEach((line: any) => {
      const code = String(line?.account_code || "").trim();
      if (!code) return;
      const canonical = this.getCanonicalAccountDefinition(
        code,
        line?.account_name || line?.description,
      );
      let account = this.state.accounts.find((item: any) => String(item.code) === code);
      if (!account) {
        account = {
          code: canonical.code,
          name_ar: canonical.name_ar,
          type: canonical.type,
          level: canonical.level,
          balance: 0,
          initial_balance: 0,
          status: "active",
          currency: canonical.currency || defaultCurrency,
          system_binding: "none",
        };
        this.state.accounts.push(account);
      } else if (!account.name_ar || String(account.name_ar).includes("حساب محاسبي")) {
        account.name_ar = canonical.name_ar;
      }
      account.type = account.type || canonical.type;
      account.level = account.level || canonical.level;
      account.currency = account.currency || canonical.currency || defaultCurrency;
      line.account_code = canonical.code;
      line.account_name = account.name_ar;
    });
  }

  addJournalEntry(description, lines, reference, currency = "USD", date, customId) {
    const targetDate = date || /* @__PURE__ */ new Date().toISOString().split("T")[0];
    const check = this.checkCanModifyJournalEntry(targetDate);
    if (!check.allowed && !customId?.startsWith("ORACLE")) {
      console.warn("Accounting period / year is locked:", check.reason);
      throw new Error(check.reason || "You cannot edit restrictions in a closed year.");
    }
    if (!Array.isArray(lines) || lines.length < 2) {
      throw new Error("A journal entry requires at least two lines");
    }

    const defaultEntryCurrency = (currency || lines[0]?.currency || "USD").toUpperCase();

    // Auto-synchronize currency and conversion rate (معامل التحويل) on every line
    lines.forEach((line) => {
      const lineCurr = (line.currency || defaultEntryCurrency || "USD").toUpperCase();
      line.currency = lineCurr;
      if (
        line.rate === undefined ||
        line.rate === null ||
        Number(line.rate) <= 0 ||
        (Number(line.rate) === 1 && lineCurr !== "USD")
      ) {
        line.rate = this.getExchangeRate(lineCurr);
      } else {
        line.rate = Number(line.rate);
      }
    });

    this.ensureJournalAccounts(lines, defaultEntryCurrency);
    for (const line of lines) {
      const debit = Number(line?.debit ?? 0);
      const credit = Number(line?.credit ?? 0);
      if (!Number.isFinite(debit) || !Number.isFinite(credit) || debit < 0 || credit < 0) {
        throw new Error("Journal debit/credit values must be finite and non-negative");
      }
      if (debit > 0 && credit > 0) {
        throw new Error("A journal line cannot contain both debit and credit");
      }
      if (debit === 0 && credit === 0) {
        throw new Error("A journal line must contain a positive debit or credit");
      }
    }
    const totalDebit = lines.reduce(
      (sum, l) => sum + this.getLineBaseValue(l.debit, l.rate || 1, l.currency || "USD"),
      0,
    );
    const totalCredit = lines.reduce(
      (sum, l) => sum + this.getLineBaseValue(l.credit, l.rate || 1, l.currency || "USD"),
      0,
    );
    if (Math.abs(totalDebit - totalCredit) > 0.000001) {
      console.error(
        `Double-entry balance mismatch error: Debit (Base): ${totalDebit}, Credit (Base): ${totalCredit}`,
      );
      throw new Error(`Unbalanced journal entry: debit=${totalDebit}, credit=${totalCredit}`);
    }
    const entry = {
      id:
        customId && customId.trim()
          ? customId.trim()
          : "je-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      branch_id: this.state.currentBranchId,
      date: targetDate,
      description,
      lines,
      created_at: /* @__PURE__ */ new Date().toISOString(),
      reference: this.generateJournalReference(targetDate, reference),
      currency: defaultEntryCurrency,
      created_by: this.state.currentUser,
      is_approved: true,
    };
    this.state.journalEntries.unshift(entry);
    this.recalculateAccountBalances();
    this.saveState();
    this.notify();
    return entry;
  }
  postSalesInvoiceJournal(
    orderNumber,
    total,
    subtotal,
    tax,
    paymentMethod = "cash",
    branchId,
    currency = "EGP",
    treasuryId = "tr-1",
    containerId,
  ) {
    let treasuryAccount = "101000";
    if (paymentMethod === "card") treasuryAccount = "102000";
    else if (paymentMethod === "wallet") treasuryAccount = "103000";
    const rate = this.getExchangeRate(currency);
    const lines = [
      {
        account_code: treasuryAccount,
        debit: total,
        credit: 0,
        currency: currency,
        rate: rate,
      },
      {
        account_code: "401000",
        debit: 0,
        credit: subtotal,
        currency: currency,
        rate: rate,
      },
      {
        account_code: "202000",
        debit: 0,
        credit: tax,
        currency: currency,
        rate: rate,
      },
    ];
    this.addJournalEntry(
      `فاتورة مبيعات POS - طلب رقم #${orderNumber}`,
      lines,
      `INV-${orderNumber}`,
      currency,
    );

    // Track in active restaurant shift if one is open
    const activeShift = this.getActiveRestaurantShift();
    if (activeShift) {
      if (!activeShift.generated_journal_refs) activeShift.generated_journal_refs = [];
      if (!activeShift.generated_journal_refs.includes(`INV-${orderNumber}`)) {
        activeShift.generated_journal_refs.push(`INV-${orderNumber}`);
      }
      activeShift.orders_count = (activeShift.orders_count || 0) + 1;
      activeShift.total_sales = (activeShift.total_sales || 0) + Number(total || 0);
      activeShift.total_tax = (activeShift.total_tax || 0) + Number(tax || 0);
      activeShift.net_total = Math.max(
        0,
        (activeShift.total_sales || 0) - (activeShift.total_refunds || 0),
      );
      if (!activeShift.payment_breakdown) {
        activeShift.payment_breakdown = { cash: 0, card: 0, wallet: 0 };
      }
      if (paymentMethod === "card") {
        activeShift.payment_breakdown.card =
          (activeShift.payment_breakdown.card || 0) + Number(total || 0);
      } else if (paymentMethod === "wallet") {
        activeShift.payment_breakdown.wallet =
          (activeShift.payment_breakdown.wallet || 0) + Number(total || 0);
      } else {
        activeShift.payment_breakdown.cash =
          (activeShift.payment_breakdown.cash || 0) + Number(total || 0);
      }
      this.saveState();
    }
    try {
      this.addTreasuryTransaction(
        treasuryId,
        "sales",
        total,
        currency,
        `إيرادات مبيعات المطعم - طلب رقم #${orderNumber}`,
        `INV-${orderNumber}`,
        paymentMethod,
        containerId,
      );
    } catch (err) {
      console.error("Error adding treasury transaction for order:", err);
    }
  }
  syncOperationalSalesWithTreasury(orders, targetTreasuryId) {
    let syncedCount = 0;
    let totalAmountSynced = 0;
    let alreadySyncedCount = 0;
    const trId =
      targetTreasuryId ||
      this.state.treasuries.find((t) => t.linked_to_restaurant && !t.deleted)?.id ||
      "tr-1";
    const targetTreasury = this.state.treasuries.find((t) => t.id === trId);
    if (!targetTreasury) {
      console.warn("Target cashier treasury not found for sync");
      return {
        syncedCount: 0,
        totalAmountSynced: 0,
        alreadySyncedCount: 0,
      };
    }
    const validOrders = (orders || []).filter(
      (o) => o && o.order_number && o.status !== "cancelled",
    );
    for (const order of validOrders) {
      const orderRef = `INV-${order.order_number}`;
      if (this.state.treasuryTransactions.find((tx) => tx.related_entity_id === orderRef)) {
        alreadySyncedCount++;
        continue;
      }
      let orderCurrency = "EGP";
      if (order.currency) orderCurrency = order.currency;
      else if (order.notes) {
        const match = String(order.notes).match(/العملة:\s*([A-Za-z]+)/);
        if (match && match[1]) orderCurrency = match[1];
      }
      const totalAmt = Number(order.total || 0);
      const subtotalAmt = Number(order.subtotal || totalAmt);
      const taxAmt = Number(order.tax || 0);
      const paymentMethod = order.payment_method || "cash";
      let containerId = "";
      if (targetTreasury.containers && targetTreasury.containers.length > 0) {
        const matchedCnt =
          targetTreasury.containers.find(
            (c) =>
              c.currency === orderCurrency &&
              ((paymentMethod === "cash" && c.id.includes("cash")) ||
                (paymentMethod === "card" && c.id.includes("card")) ||
                (paymentMethod === "wallet" && c.id.includes("wallet"))),
          ) || targetTreasury.containers.find((c) => c.currency === orderCurrency);
        if (matchedCnt) containerId = matchedCnt.id;
      }
      try {
        this.postSalesInvoiceJournal(
          order.order_number,
          totalAmt,
          subtotalAmt,
          taxAmt,
          paymentMethod,
          this.state.currentBranchId || "BR-001",
          orderCurrency,
          trId,
          containerId,
        );
        syncedCount++;
        totalAmountSynced += totalAmt;
      } catch (err) {
        console.error(`Error syncing order #${order.order_number}:`, err);
      }
    }
    if (syncedCount > 0) {
      this.recalculateAccountBalances();
      this.saveState();
      this.logAction(
        "CASHIER",
        "مزامنة مبيعات اليوم التشغيلية",
        `تمت مزامنة ${syncedCount} طلب مبيعات بقيمة إجمالية ${totalAmountSynced.toLocaleString()} مع خزينة الكاشير (${targetTreasury.name_ar})`,
        "TRANSACTION",
      );
    }
    return {
      syncedCount,
      totalAmountSynced,
      alreadySyncedCount,
    };
  }
  postSalesReturnJournal(
    orderNumber,
    total,
    paymentMethod = "cash",
    branchId,
    currency = "EGP",
    treasuryId = "tr-1",
    containerId,
  ) {
    let treasuryAccount = "101000";
    if (paymentMethod === "card") treasuryAccount = "102000";
    else if (paymentMethod === "wallet") treasuryAccount = "103000";
    const rate = this.getExchangeRate(currency);
    const lines = [
      {
        account_code: "401000",
        debit: total,
        credit: 0,
        currency: currency,
        rate: rate,
      },
      {
        account_code: treasuryAccount,
        debit: 0,
        credit: total,
        currency: currency,
        rate: rate,
      },
    ];
    this.addJournalEntry(
      `مرتجع مبيعات POS - طلب رقم #${orderNumber}`,
      lines,
      `SRT-${orderNumber}`,
      currency,
    );
    try {
      this.addTreasuryTransaction(
        treasuryId,
        "withdrawal",
        total,
        currency,
        `مرتجع مبيعات المطعم - طلب رقم #${orderNumber}`,
        `SRT-${orderNumber}`,
        paymentMethod,
        containerId,
      );
    } catch (err) {
      console.error("Error adding treasury transaction for refund:", err);
    }
  }
  postPurchaseInvoiceJournal(
    poId: string,
    supplierId: string,
    total: number,
    branchId: string,
    currency: string = "USD",
    rate: number = 1,
    supplierAccountCode?: string,
  ) {
    const supplier = this.state.suppliers.find((s) => s.id === supplierId);
    const targetSupAcc = supplierAccountCode || supplier?.account_code || "201000";
    const resolvedRate =
      rate && rate > 0 && !(rate === 1 && currency !== "USD")
        ? rate
        : this.getExchangeRate(currency);

    const lines = [
      {
        account_code: "103000",
        debit: total,
        credit: 0,
        currency: currency || "USD",
        rate: resolvedRate,
        description: `استلام مخزون بضاعة - أمر شراء #${poId.substring(3, 8)}`,
      },
      {
        account_code: targetSupAcc,
        debit: 0,
        credit: total,
        currency: currency || "USD",
        rate: resolvedRate,
        description: `استحقاق المورد (${supplier?.name_ar || "مورد"}) - أمر شراء #${poId.substring(3, 8)}`,
      },
    ];
    this.addJournalEntry(
      `فاتورة مشتريات للمورد ${supplier?.name_ar || ""} - أمر شراء #${poId.substring(3, 8)}`,
      lines,
      `PO-${poId.substring(3, 8).toUpperCase()}`,
      currency,
    );
  }
  postPurchaseReturnJournal(
    poId: string,
    amount: number,
    branchId: string,
    currency: string = "USD",
    rate: number = 1,
    supplierAccountCode?: string,
  ) {
    const supplier = this.state.suppliers.find(
      (s) => s.id === this.state.purchaseOrders.find((p) => p.id === poId)?.supplier_id,
    );
    const targetSupAcc = supplierAccountCode || supplier?.account_code || "201000";
    const resolvedRate =
      rate && rate > 0 && !(rate === 1 && currency !== "USD")
        ? rate
        : this.getExchangeRate(currency);

    const lines = [
      {
        account_code: targetSupAcc,
        debit: amount,
        credit: 0,
        currency: currency || "USD",
        rate: resolvedRate,
        description: `مرتجع بضائع للمورد (${supplier?.name_ar || "مورد"}) - أمر شراء #${poId.substring(3, 8)}`,
      },
      {
        account_code: "103000",
        debit: 0,
        credit: amount,
        currency: currency || "USD",
        rate: resolvedRate,
        description: `تخفيض مخزون بضاعة مرتجعة - أمر شراء #${poId.substring(3, 8)}`,
      },
    ];
    this.addJournalEntry(
      `مرتجع بضائع مشتريات للمورد - أمر شراء #${poId.substring(3, 8)}`,
      lines,
      `PRT-${poId.substring(3, 8).toUpperCase()}`,
      currency,
    );
  }
  postExpenseJournal(voucherId, amount, accountCode, costCenter, branchId, currency = "EGP") {
    const rate = this.getExchangeRate(currency);
    const lines = [
      {
        account_code: accountCode,
        debit: amount,
        credit: 0,
        cost_center: costCenter,
        currency: currency,
        rate: rate,
      },
      {
        account_code: branchId === "branch-2" ? "101001" : "101000",
        debit: 0,
        credit: amount,
        currency: currency,
        rate: rate,
      },
    ];
    this.addJournalEntry(
      `سند صرف مصروفات - رقم #${voucherId.substring(4, 9)}`,
      lines,
      `EXP-${voucherId.substring(4, 9).toUpperCase()}`,
      currency,
    );
  }
  postRevenueJournal(voucherId, amount, accountCode, costCenter, branchId, currency = "EGP") {
    const rate = this.getExchangeRate(currency);
    const lines = [
      {
        account_code: branchId === "branch-2" ? "101001" : "101000",
        debit: amount,
        credit: 0,
        currency: currency,
        rate: rate,
      },
      {
        account_code: accountCode,
        debit: 0,
        credit: amount,
        cost_center: costCenter,
        currency: currency,
        rate: rate,
      },
    ];
    this.addJournalEntry(
      `سند قبض إيرادات متنوعة - رقم #${voucherId.substring(4, 9)}`,
      lines,
      `REV-${voucherId.substring(4, 9).toUpperCase()}`,
      currency,
    );
  }
  postTreasuryTransferJournal(fromTreasuryId, toTreasuryId, amount, branchId, currency?: string) {
    const fromT = this.state.treasuries.find((t) => t.id === fromTreasuryId);
    const toT = this.state.treasuries.find((t) => t.id === toTreasuryId);
    if (!fromT || !toT) return;
    const curr = currency || fromT.currency || "USD";
    const rate = this.getExchangeRate(curr);
    const fromAcc =
      fromT.type === "bank" ? "102000" : fromT.branch_id === "branch-2" ? "101001" : "101000";
    const lines = [
      {
        account_code:
          toT.type === "bank" ? "102000" : toT.branch_id === "branch-2" ? "101001" : "101000",
        debit: amount,
        credit: 0,
        currency: curr,
        rate: rate,
      },
      {
        account_code: fromAcc,
        debit: 0,
        credit: amount,
        currency: curr,
        rate: rate,
      },
    ];
    this.addJournalEntry(
      `حركة تحويل مالي بين الخزائن - من ${fromT.name_ar} إلى ${toT.name_ar}`,
      lines,
      `TRF-${Math.floor(Math.random() * 8999) + 1e3}`,
      curr,
    );
  }
  postCashDepositJournal(treasuryId, amount, branchId, currency?: string) {
    const tr = this.state.treasuries.find((t) => t.id === treasuryId);
    const curr = currency || tr?.currency || "USD";
    const rate = this.getExchangeRate(curr);
    const lines = [
      {
        account_code: branchId === "branch-2" ? "101001" : "101000",
        debit: amount,
        credit: 0,
        currency: curr,
        rate: rate,
      },
      {
        account_code: "301000",
        debit: 0,
        credit: amount,
        currency: curr,
        rate: rate,
      },
    ];
    this.addJournalEntry(
      `إيداع تمويل مالي مباشر بالخزينة`,
      lines,
      `DEP-${Math.floor(Math.random() * 8999) + 1e3}`,
      curr,
    );
  }
  postCashWithdrawalJournal(treasuryId, amount, branchId, currency?: string) {
    const tr = this.state.treasuries.find((t) => t.id === treasuryId);
    const curr = currency || tr?.currency || "USD";
    const rate = this.getExchangeRate(curr);
    const lines = [
      {
        account_code: "301000",
        debit: amount,
        credit: 0,
        currency: curr,
        rate: rate,
      },
      {
        account_code: branchId === "branch-2" ? "101001" : "101000",
        debit: 0,
        credit: amount,
        currency: curr,
        rate: rate,
      },
    ];
    this.addJournalEntry(
      `سحب نقدي مباشر تمويلي من الخزينة`,
      lines,
      `WDL-${Math.floor(Math.random() * 8999) + 1e3}`,
      curr,
    );
  }
  postInventoryAdjustmentJournal(docNumber, amount, branchId, currency = "USD") {
    const rate = this.getExchangeRate(currency);
    const lines = [
      {
        account_code: "506000",
        debit: Math.abs(amount),
        credit: 0,
        currency: currency,
        rate: rate,
      },
      {
        account_code: "103000",
        debit: 0,
        credit: Math.abs(amount),
        currency: currency,
        rate: rate,
      },
    ];
    this.addJournalEntry(
      `تسوية جرد مخزني - هدر وخسائر - مستند #${docNumber}`,
      lines,
      `ADJ-${docNumber.substring(4)}`,
      currency,
    );
  }
  postInventoryConsumptionJournal(orderNumber, totalCost, branchId, currency = "USD") {
    const rate = this.getExchangeRate(currency);
    const lines = [
      {
        account_code: "501000",
        debit: totalCost,
        credit: 0,
        currency: currency,
        rate: rate,
      },
      {
        account_code: "103000",
        debit: 0,
        credit: totalCost,
        currency: currency,
        rate: rate,
      },
    ];
    this.addJournalEntry(
      `قيد استهلاك بوم المطبخ (Recipe Consumption) - طلب #${orderNumber}`,
      lines,
      `CON-${orderNumber}`,
      currency,
    );
  }
  createPurchaseOrder(
    supplierId: string,
    items: any[],
    notes?: string,
    currency: "USD" | "SSP" | string = "USD",
    exchange_rate: number = 1,
  ) {
    let subtotal = 0;
    items.forEach((i) => {
      subtotal += i.quantity * i.unit_cost;
    });
    const tax = subtotal * 0.14;
    const total = subtotal + tax;
    const rate = Number(exchange_rate) || 1;
    const total_base_usd = currency === "USD" ? total : rate > 1 ? total / rate : total * rate;

    const po: PurchaseOrder = {
      id: "po-" + Date.now(),
      branch_id: this.state.currentBranchId,
      supplier_id: supplierId,
      order_date: /* @__PURE__ */ new Date().toISOString().split("T")[0],
      status: "draft",
      items,
      subtotal,
      tax,
      total,
      currency: currency || "USD",
      exchange_rate: rate,
      total_base_usd,
      notes,
    };
    this.state.purchaseOrders.unshift(po);
    this.saveState();
    this.logAction(
      "ADMIN",
      "إنشاء أمر شراء",
      `تم عمل مسودة أمر شراء بمجموع ${total.toLocaleString()} ${po.currency} للمورد`,
      "CREATE",
    );
    this.notify();
    return po;
  }
  receivePurchaseOrder(poId: string, treasuryId?: string) {
    const po = this.state.purchaseOrders.find((p) => p.id === poId);
    if (!po || po.status === "received") return;
    po.status = "received";
    po.received_date = new Date().toISOString().split("T")[0];

    const supplier = this.state.suppliers.find((s) => s.id === po.supplier_id);
    const supAccCode = supplier?.account_code || "201000";
    const currency = po.currency || "USD";
    const rate = Number(po.exchange_rate) || 1;

    const treasury =
      this.state.treasuries.find((t) => t.id === treasuryId) || this.state.treasuries[0];
    if (treasury) {
      this.addTreasuryTransaction(
        treasury.id,
        "purchase",
        po.total,
        currency,
        `شراء بضاعة - أمر شراء #${po.id.substring(3, 8)} (${supplier?.name_ar || ""})`,
        po.id,
      );
    }
    this.updateSupplierBalance(po.supplier_id, po.total);
    this.postPurchaseInvoiceJournal(
      po.id,
      po.supplier_id,
      po.total,
      this.state.currentBranchId,
      currency,
      rate,
      supAccCode,
    );
    this.logAction(
      "ADMIN",
      "استلام أمر شراء ودفع القيمة",
      `تم تسليم الطلبية #${poId.substring(3, 8)} وإجراء القيد المحاسبي على حساب المورد (${supAccCode}) بمبلغ ${po.total.toLocaleString()} ${currency}`,
      "TRANSACTION",
    );
    this.saveState();
    this.notify();
  }
  receivePurchaseOrderPartial(poId, receivedItems, treasuryId) {
    const po = this.state.purchaseOrders.find((p) => p.id === poId);
    if (!po) throw new Error("أمر الشراء غير موجود");
    let newlyReceivedTotal = 0;
    let isFullyReceived = true;
    po.items = po.items.map((item) => {
      const match = receivedItems.find((r) => r.inventory_id === item.inventory_id);
      const currentReceived = item.received_quantity || 0;
      const newlyReceived = match ? match.received_quantity : 0;
      const updatedReceived = currentReceived + newlyReceived;
      if (updatedReceived < item.quantity) isFullyReceived = false;
      newlyReceivedTotal += newlyReceived * item.unit_cost;
      return {
        ...item,
        received_quantity: updatedReceived,
      };
    });
    const newlyReceivedTax = newlyReceivedTotal * 0.14;
    const grandReceivedTotal = newlyReceivedTotal + newlyReceivedTax;
    if (isFullyReceived) po.status = "received";
    const treasury = this.state.treasuries.find((t) => t.id === treasuryId);
    if (treasury && grandReceivedTotal > 0)
      this.addTreasuryTransaction(
        treasuryId,
        "purchase",
        grandReceivedTotal,
        treasury.currency,
        `استلام جزئي/كامل بضائع - أمر شراء #${po.id.substring(3, 8)}`,
        po.id,
      );
    this.updateSupplierBalance(po.supplier_id, grandReceivedTotal);
    if (grandReceivedTotal > 0)
      this.postPurchaseInvoiceJournal(
        po.id,
        po.supplier_id,
        grandReceivedTotal,
        this.state.currentBranchId,
      );
    this.logAction(
      "ADMIN",
      "استلام بضائع أمر شراء",
      `تم استلام بضائع من الأمر #${po.id.substring(3, 8)} بقيمة ${grandReceivedTotal.toFixed(2)} ج.م (مكتمل: ${isFullyReceived ? "نعم" : "لا"})`,
      "TRANSACTION",
    );
    this.saveState();
    return {
      receivedTotal: grandReceivedTotal,
      isFullyReceived,
    };
  }
  returnPurchaseOrderItems(poId, returnedItems) {
    const po = this.state.purchaseOrders.find((p) => p.id === poId);
    if (!po) throw new Error("أمر الشراء غير موجود");
    let returnedTotal = 0;
    po.items = po.items.map((item) => {
      const match = returnedItems.find((r) => r.inventory_id === item.inventory_id);
      const currentReturned = item.returned_quantity || 0;
      const newlyReturned = match ? match.returned_quantity : 0;
      const updatedReturned = currentReturned + newlyReturned;
      returnedTotal += newlyReturned * item.unit_cost;
      return {
        ...item,
        returned_quantity: updatedReturned,
      };
    });
    const returnedTax = returnedTotal * 0.14;
    const grandReturnedTotal = returnedTotal + returnedTax;
    po.status = "returned";
    this.updateSupplierBalance(po.supplier_id, -grandReturnedTotal);
    this.postPurchaseReturnJournal(po.id, grandReturnedTotal, this.state.currentBranchId);
    this.logAction(
      "ADMIN",
      "إرجاع بضائع للمورد",
      `تم إرجاع مرتجعات من الأمر #${po.id.substring(3, 8)} بقيمة ${grandReturnedTotal.toFixed(2)} ج.م خصماً من حساب المورد`,
      "TRANSACTION",
    );
    this.saveState();
    return grandReturnedTotal;
  }
  cancelPurchaseOrder(poId) {
    const po = this.state.purchaseOrders.find((p) => p.id === poId);
    if (!po || po.status === "cancelled") return false;
    const oldStatus = po.status;
    po.status = "cancelled";
    if (oldStatus === "received") {
      const tx = this.state.treasuryTransactions.find(
        (t) => t.related_entity_id === poId && t.type === "purchase",
      );
      if (tx) {
        const treasury = this.state.treasuries.find((t) => t.id === tx.treasury_id);
        if (treasury) {
          treasury.balance += tx.amount;
          treasury.available_balance = treasury.balance;
          this.logAction(
            "SYSTEM",
            "عكس حركة الخزينة",
            `استرجاع مبلغ ${tx.amount} ج.م إلى خزينة ${treasury.name_ar}`,
            "TRANSACTION",
          );
        }
      }
      this.updateSupplierBalance(po.supplier_id, -po.total);
      const lines = [
        {
          account_code: "103000",
          debit: 0,
          credit: po.total,
        },
        {
          account_code: "201000",
          debit: po.total,
          credit: 0,
        },
      ];
      this.addJournalEntry(
        `إلغاء وعكس قيد أمر شراء #${poId.substring(3, 8)}`,
        lines,
        `REV-${poId.substring(3, 8).toUpperCase()}`,
      );
    }
    this.saveState();
    this.logAction(
      "ADMIN",
      "إلغاء أمر الشراء",
      `تم إلغاء أمر الشراء #${poId.substring(3, 8)} بالكامل وتصفية القيود المرتبطة`,
      "TRANSACTION",
    );
    return true;
  }
  createVoucher(
    type,
    category,
    amount,
    treasuryId,
    description,
    costCenter = "الإدارة (Administration)",
    attachment,
  ) {
    const treasury = this.state.treasuries.find((t) => t.id === treasuryId);
    const voucher = {
      id: "vch-" + Date.now(),
      branch_id: this.state.currentBranchId,
      type,
      category,
      amount,
      currency: treasury?.currency || "EGP",
      payment_method: treasury?.type || "cash",
      treasury_id: treasuryId,
      description,
      status: "approved",
      created_at: /* @__PURE__ */ new Date().toISOString(),
      cost_center: costCenter,
      attachment,
      deleted: false,
    };
    this.state.vouchers.unshift(voucher);
    this.saveState();
    if (treasury) {
      const txType = type === "receipt" ? "deposit" : "withdrawal";
      this.addTreasuryTransaction(
        treasuryId,
        txType,
        amount,
        treasury.currency,
        `${type === "receipt" ? "سند قبض" : "سند صرف"} (${category}) - ${description}`,
        voucher.id,
      );
      const accountCode =
        {
          "رواتب الموظفين": "502000",
          "إيجار الفروع": "503000",
          "الكهرباء والمياه والطاقة": "504000",
          "التسويق والإعلانات": "505000",
          "الهدر والمفقودات": "506000",
        }[category] || "600000";
      if (type === "payment")
        this.postExpenseJournal(
          voucher.id,
          amount,
          accountCode,
          costCenter,
          this.state.currentBranchId,
        );
      else
        this.postRevenueJournal(
          voucher.id,
          amount,
          "401000",
          costCenter,
          this.state.currentBranchId,
        );
    }
    this.logAction(
      "ADMIN",
      "إنشاء سند مالي",
      `تم تسجيل ${type === "receipt" ? "سند قبض" : "سند صرف"} فئة ${category} بمبلغ ${amount} ج.م بمركز تكلفة ${costCenter}`,
      "CREATE",
    );
    return voucher;
  }
  deleteVoucher(id) {
    const vch = this.state.vouchers.find((v) => v.id === id);
    if (vch) {
      vch.deleted = true;
      this.saveState();
      this.logAction(
        "ADMIN",
        "حذف سند مالي (حذف مؤقت)",
        `تم حذف السند المالي #${id} مؤقتاً`,
        "DELETE",
      );
    }
  }
  addExpiryBatch(inventoryId, batchNo, qty, expiryDate, warehouseId, storageCondition) {
    this.state.inventoryExpiry.push({
      id: "exp-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      inventory_id: inventoryId,
      branch_id: this.state.currentBranchId,
      warehouse_id: warehouseId || "wh-main-default",
      storage_condition: storageCondition || "chilled_4c",
      batch_no: batchNo,
      quantity: qty,
      expiry_date: expiryDate,
      created_at: /* @__PURE__ */ new Date().toISOString(),
    });
    this.saveState();
    this.logAction(
      "ADMIN",
      "إضافة دفعة تاريخ صلاحية",
      `إضافة الدفعة ${batchNo} للكمية ${qty} صالحة حتى ${expiryDate}`,
      "CREATE",
    );
  }
  async disposeExpiryBatch(batchId, reason) {
    const idx = this.state.inventoryExpiry.findIndex((b) => b.id === batchId);
    if (idx !== -1) {
      const batch = this.state.inventoryExpiry[idx];
      const item = localWarehouseStore.getInventory().find((i) => i.id === batch.inventory_id);
      const cost = item ? Number(item.cost || 0) : 0;
      const qty = Number(batch.quantity || 0);
      const batchValue = qty * cost;
      this.state.totalDisposedExpiryValue = (this.state.totalDisposedExpiryValue || 0) + batchValue;
      if (batch.inventory_id && qty > 0)
        try {
          await inventoryService.addTransaction({
            inventory_id: batch.inventory_id,
            warehouse_id: batch.warehouse_id || "wh-main-default",
            type: "out",
            quantity: qty,
            note: `إعدام وهدر دفعة رقم ${batch.batch_no} - السبب: ${reason}`,
          });
        } catch (err) {
          console.error("Failed to add inventory transaction for batch disposal:", err);
          localWarehouseStore.addTransaction({
            inventory_id: batch.inventory_id,
            warehouse_id: batch.warehouse_id || "wh-main-default",
            type: "out",
            quantity: qty,
            note: `إعدام وهدر دفعة رقم ${batch.batch_no} - السبب: ${reason}`,
          });
        }
      if (batchValue > 0)
        this.postInventoryAdjustmentJournal(
          batch.batch_no || batch.id.slice(0, 8),
          batchValue,
          this.state.currentBranchId,
        );
      this.state.inventoryExpiry.splice(idx, 1);
      this.saveState();
      this.logAction(
        "ADMIN",
        "إعدام دفعة منتهية الصلاحية",
        `تم إعدام الدفعة ${batch.batch_no} بالكمية ${batch.quantity} (بقيمة ${batchValue} ج.م) بسبب: ${reason}، وتم الخصم من المخزن وإنشاء قيد المحاسبي تلقائياً`,
        "DELETE",
      );
    }
  }
  getMenuItemQualitySpecs(menuItemId) {
    if (!this.state.menuQualitySpecs) this.state.menuQualitySpecs = {};
    if (!this.state.menuQualitySpecs[menuItemId])
      this.state.menuQualitySpecs[menuItemId] = {
        menu_item_id: menuItemId,
        shelf_life_hours: 24,
        storage_condition: "chilled_4c",
        storage_condition_label: "ثلاجة مبردة (4°م)",
        prep_instructions:
          "يتم التحضير والتسخين وفق معايير النظافة والطهي الآمن على درجة حرارة 75°م على الأقل.",
        allergens: ["جلوتين", "ألبان"],
        quality_checklist: [
          "فحص الرائحة والقوام قبل التقديم",
          "التأكد من سلامة التغليف وتاريخ التجهيز",
          "قياس درجة الحرارة عند الحفظ (أقل من 5°م للمبرد)",
        ],
        max_display_hours: 4,
      };
    return this.state.menuQualitySpecs[menuItemId];
  }
  saveMenuItemQualitySpecs(menuItemId, specs) {
    if (!this.state.menuQualitySpecs) this.state.menuQualitySpecs = {};
    const current = this.getMenuItemQualitySpecs(menuItemId);
    this.state.menuQualitySpecs[menuItemId] = {
      ...current,
      ...specs,
    };
    this.saveState();
    this.logAction(
      "ADMIN",
      "تحديث معايير جودة وصلاحية الوجبة",
      `تم تحديث مواصفات جودة وصلاحية الوجبة #${menuItemId}`,
      "UPDATE",
    );
  }
  setPeriodLock(isLocked: boolean) {
    this.state.isAccountingPeriodLocked = isLocked;
    this.saveState();
    this.logAction(
      "ADMIN",
      isLocked ? "إغلاق الفترة المحاسبية" : "فتح الفترة المحاسبية",
      "تم تحديث قفل الفترة المحاسبية لمنع تعديل القيود التاريخية",
      "SYSTEM",
    );
    this.notify();
  }
  setFiscalYearStatus(status: "open" | "closed") {
    this.state.fiscalYearStatus = status;
    this.saveState();
    this.logAction(
      "ADMIN",
      status === "closed" ? "إغلاق السنة المالية" : "فتح السنة المالية الجديدة",
      `تم تحديث حالة السنة المالية الحالية إلى ${status === "closed" ? "مغلقة" : "مفتوحة"}`,
      "SYSTEM",
    );
    this.notify();
  }
  getExtendedItem(itemId, defaultVals) {
    if (!this.state.extendedInventoryItems) this.state.extendedInventoryItems = {};
    if (!this.state.extendedInventoryItems[itemId]) {
      const generatedCode = "INV-" + itemId.substring(0, 5).toUpperCase();
      const generatedBarcode =
        "622" +
        Math.abs(itemId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0))
          .toString()
          .padEnd(10, "0")
          .substring(0, 10);
      this.state.extendedInventoryItems[itemId] = {
        id: itemId,
        item_code: generatedCode,
        barcode: generatedBarcode,
        name_en: "Raw Material Item",
        category: "خامات ومواد أولية",
        preferred_supplier_id: "sup-1",
        average_cost: 0,
        last_purchase_price: 0,
        status: "active",
        ...defaultVals,
      };
      this.saveState();
    }
    return this.state.extendedInventoryItems[itemId];
  }
  saveExtendedItem(itemId, details) {
    if (!this.state.extendedInventoryItems) this.state.extendedInventoryItems = {};
    const old = { ...this.getExtendedItem(itemId) };
    this.state.extendedInventoryItems[itemId] = {
      ...this.getExtendedItem(itemId),
      ...details,
    };
    this.saveState();
    const changes = [];
    Object.keys(details).forEach((key) => {
      const valOld = old[key];
      const valNew = details[key];
      if (valOld !== valNew) changes.push(`[${key}]: ${valOld} -> ${valNew}`);
    });
    if (changes.length > 0)
      this.logAction(
        "ADMIN",
        "تعديل تفاصيل الصنف المتقدمة",
        `تم تعديل الصنف #${itemId.substring(0, 5)}: ${changes.join(", ")}`,
        "UPDATE",
      );
  }
  getExtendedItems() {
    return this.state.extendedInventoryItems || {};
  }
  addInventoryDocument(doc) {
    if (!this.state.inventoryDocuments) this.state.inventoryDocuments = [];
    const docCount = this.state.inventoryDocuments.length + 1;
    const docNumber = `DOC-2026-${String(docCount).padStart(4, "0")}`;
    const newDoc = {
      ...doc,
      id: "doc-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      doc_number: docNumber,
      created_at: /* @__PURE__ */ new Date().toISOString(),
    };
    this.state.inventoryDocuments.unshift(newDoc);
    this.saveState();
    this.logAction(
      "ADMIN",
      `إنشاء مستند مخزني: ${doc.type}`,
      `تم تسجيل مستند ${doc.type} برقم ${docNumber} ويحتوي على ${doc.items.length} أصناف`,
      "CREATE",
    );
    if (doc.type === "stock_adjustment") {
      let adjustmentVal = 0;
      doc.items.forEach((it) => {
        const diff = (it.counted_quantity ?? 0) - it.quantity;
        adjustmentVal += diff * it.unit_cost;
      });
      if (Math.abs(adjustmentVal) > 0)
        this.postInventoryAdjustmentJournal(docNumber, adjustmentVal, doc.branch_id);
    }
    return newDoc;
  }
  recordInventoryDocTransaction(tx: {
    inventory_id: string;
    type: string;
    quantity: number;
    note?: string;
    currency?: string;
    exchange_rate?: number;
    treasury_id?: string;
    treasury_name?: string;
    supplier_id?: string;
    supplier_name?: string;
    supplier_account_code?: string;
    transaction_date?: string;
    transaction_time?: string;
    system_timestamp?: string;
    tx_number?: string;
    journal_entry_ref?: string;
  }) {
    if (!this.state.inventoryDocuments) this.state.inventoryDocuments = [];
    const docNumber = tx.tx_number || `DOC-${Date.now()}`;
    const newDoc = {
      id: "doc-tx-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      doc_number: docNumber,
      doc_type: (tx.type === "in"
        ? "receipt_note"
        : tx.type === "out"
          ? "issue_note"
          : "stock_adjustment") as any,
      type: (tx.type === "in"
        ? "receipt_note"
        : tx.type === "out"
          ? "issue_note"
          : "stock_adjustment") as any,
      status: "completed" as const,
      doc_date: tx.transaction_date || new Date().toISOString().split("T")[0],
      created_at: new Date().toISOString(),
      items: [
        {
          inventory_id: tx.inventory_id,
          quantity: tx.quantity,
          unit_cost: 0,
          total_cost: 0,
          notes: tx.note || "",
        },
      ],
      notes: tx.note,
    };
    this.state.inventoryDocuments.unshift(newDoc);

    try {
      inventoryService
        .addTransaction({
          inventory_id: tx.inventory_id,
          type: (tx.type === "in" ||
          tx.type === "out" ||
          tx.type === "transfer" ||
          tx.type === "waste"
            ? tx.type
            : "adjustment") as any,
          quantity: tx.quantity,
          note: tx.note,
          created_at: tx.system_timestamp || new Date().toISOString(),
        })
        .catch((err) => console.warn("inventoryService.addTransaction background notice:", err));
    } catch (e) {
      console.warn("inventoryService notice:", e);
    }

    this.saveState();
    return newDoc;
  }
  cancelInventoryDocument(docId) {
    if (!this.state.inventoryDocuments) return false;
    const doc = this.state.inventoryDocuments.find((d) => d.id === docId);
    if (!doc || doc.status === "cancelled") return false;
    doc.status = "cancelled";
    this.saveState();
    this.logAction(
      "ADMIN",
      "إلغاء مستند مخزني",
      `تم إلغاء المستند المخزني رقم ${doc.doc_number} بنجاح`,
      "UPDATE",
    );
    return true;
  }
  saveInventorySettings(settings) {
    this.state.inventorySettings = settings;
    this.saveState();
    this.logAction(
      "ADMIN",
      "تحديث إعدادات المخزن",
      `تم تحديث إعدادات المخزن: السماح بالبيع بالسالب (${settings.allowNegativeStock})`,
      "UPDATE",
    );
  }
  getEmployees(): Employee[] {
    return this.state.employees || [];
  }
  addEmployee(emp) {
    const newEmp = {
      ...emp,
      salary: Number(emp.salary) || 0,
      id: "emp-" + Date.now(),
    };
    if (!this.state.employees) this.state.employees = [];
    this.state.employees.push(newEmp);
    this.saveState();
    this.logAction("HR", "إضافة موظف جديد", `تم تسجيل الموظف: ${emp.name}`, "CREATE");
    this.notify();
    return newEmp;
  }
  updateEmployee(id, payload) {
    if (!this.state.employees) this.state.employees = [];
    const emp = this.state.employees.find((e) => e.id === id);
    if (emp) {
      Object.assign(emp, payload);
      if (payload.salary !== undefined) emp.salary = Number(payload.salary) || 0;
      this.saveState();
      this.logAction("HR", "تعديل بيانات موظف", `تم تعديل الموظف: ${emp.name}`, "UPDATE");
      this.notify();
    }
  }
  deleteEmployee(id) {
    if (!this.state.employees) this.state.employees = [];
    const index = this.state.employees.findIndex((e) => e.id === id);
    if (index !== -1) {
      const emp = this.state.employees[index];
      this.state.employees.splice(index, 1);
      this.saveState();
      this.logAction("HR", "حذف موظف", `تم حذف الموظف: ${emp.name}`, "DELETE");
      this.notify();
    }
  }
  recordAttendance(employeeId, date, status, checkIn, checkOut, notes) {
    if (!this.state.attendance) this.state.attendance = [];
    this.state.attendance = this.state.attendance.filter(
      (r) => !(r.employee_id === employeeId && r.date === date),
    );
    const record = {
      id: "att-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      employee_id: employeeId,
      date,
      status,
      check_in: checkIn,
      check_out: checkOut,
      notes,
    };
    this.state.attendance.push(record);
    this.saveState();
    this.notify();
  }
  addLoan(employeeId, amount, currency, repaymentMonths, notes, treasuryId) {
    if (!this.state.loans) this.state.loans = [];
    const emp = this.state.employees?.find((e) => e.id === employeeId);
    const numAmount = Number(amount) || 0;

    const loan = {
      id: "loan-" + Date.now(),
      employee_id: employeeId,
      amount: numAmount,
      date: new Date().toISOString().split("T")[0],
      currency: currency || emp?.currency || "EGP",
      repayment_months: Number(repaymentMonths) || 1,
      paid_amount: 0,
      status: "active",
      notes: notes || "",
      treasury_id: treasuryId || "",
    };
    this.state.loans.push(loan);

    // If a treasuryId is supplied, record the treasury withdrawal & journal entry
    if (treasuryId) {
      const tr = this.state.treasuries?.find((t) => t.id === treasuryId);
      if (tr) {
        const ref = `LOAN-${loan.id.slice(-6).toUpperCase()}`;
        // 1. Treasury Movement
        this.addTreasuryTransaction(
          treasuryId,
          "withdrawal",
          loan.amount,
          loan.currency,
          `صرف سلفة نقداً للموظف ${emp?.name || ""} (${notes || ""})`,
          ref,
        );

        // 2. Accounting Journal Entry
        const loanAccCode =
          (this.state.accounts || []).find(
            (a) => a.code === "15010240" || a.code === "103000" || a.name_ar.includes("سلف"),
          )?.code || "15010240";

        const treasuryAccCode =
          tr.account_code ||
          (tr.type === "bank" ? "102000" : tr.branch_id === "branch-2" ? "101001" : "101000");

        const rate = this.getExchangeRate(loan.currency);

        const journalLines = [
          {
            account_code: loanAccCode,
            debit: loan.amount,
            credit: 0,
            currency: loan.currency,
            rate: rate,
            description: `إثبات سلفة نقدية للموظف ${emp?.name || ""}`,
          },
          {
            account_code: treasuryAccCode,
            debit: 0,
            credit: loan.amount,
            currency: loan.currency,
            rate: rate,
            description: `صرف سلفة من خزينة ${tr.name_ar}`,
          },
        ];

        this.addJournalEntry(
          `صرف سلفة نقدية للموظف ${emp?.name || ""}`,
          journalLines,
          ref,
          loan.currency,
          loan.date,
        );
      }
    }

    this.recalculateAccountBalances();
    this.saveState();
    this.logAction(
      "HR",
      "طلب وصرف سلفة موظف",
      `تم تسجيل وصرف سلفة للموظف ${emp?.name || ""} بقيمة ${loan.amount} ${loan.currency}`,
      "CREATE",
    );
    this.notify();
    return loan;
  }
  repayLoan(loanId, amount) {
    if (!this.state.loans) this.state.loans = [];
    const loan = this.state.loans.find((l) => l.id === loanId);
    if (loan) {
      loan.paid_amount += amount;
      if (loan.paid_amount >= loan.amount) loan.status = "paid";
      this.saveState();
      this.notify();
    }
  }
  generatePayroll(month) {
    if (!this.state.payrolls) this.state.payrolls = [];
    if (!this.state.employees) this.state.employees = [];
    if (!this.state.loans) this.state.loans = [];
    if (!this.state.attendance) this.state.attendance = [];
    this.state.payrolls = this.state.payrolls.filter(
      (p) => p.month !== month || p.status === "paid",
    );
    this.state.employees
      .filter((e) => e.status === "active")
      .forEach((emp) => {
        if (
          this.state.payrolls?.some(
            (p) => p.employee_id === emp.id && p.month === month && p.status === "paid",
          )
        )
          return;
        const empAttendance =
          this.state.attendance?.filter(
            (r) => r.employee_id === emp.id && r.date && String(r.date).startsWith(month),
          ) || [];
        const absentDays = empAttendance.filter((r) => r.status === "absent").length;
        const lateDays = empAttendance.filter((r) => r.status === "late").length;
        const dailyRate = (emp.salary || 0) / 30;
        const deductions = Math.round(absentDays * dailyRate + lateDays * dailyRate * 0.25);
        const activeLoan = this.state.loans?.find(
          (l) => l.employee_id === emp.id && l.status === "active",
        );
        let loanDeduction = 0;
        if (activeLoan) {
          const monthlyInstallment = activeLoan.amount / (activeLoan.repayment_months || 1);
          const remainingLoan = activeLoan.amount - (activeLoan.paid_amount || 0);
          const rawDeduction = Math.min(monthlyInstallment, remainingLoan);

          if (!activeLoan.currency || activeLoan.currency === emp.currency) {
            loanDeduction = Math.round(rawDeduction);
          } else {
            const rateLoan = this.getExchangeRate(activeLoan.currency);
            const rateEmp = this.getExchangeRate(emp.currency);
            loanDeduction = Math.round((rawDeduction * rateLoan) / (rateEmp || 1));
          }
        }
        const netSalary = Math.max(0, emp.salary - deductions - loanDeduction);
        const record = {
          id: "pay-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
          employee_id: emp.id,
          month,
          basic_salary: emp.salary,
          currency: emp.currency,
          bonuses: 0,
          deductions,
          loan_deduction: loanDeduction,
          net_salary: netSalary,
          status: "draft",
        };
        this.state.payrolls?.push(record);
      });
    this.saveState();
  }
  paySalary(payrollId, treasuryId) {
    if (!this.state.payrolls) return;
    const record = this.state.payrolls.find((p) => p.id === payrollId);
    if (!record || record.status === "paid") return;
    const emp = this.state.employees?.find((e) => e.id === record.employee_id);
    if (!emp) return;
    this.addTreasuryTransaction(
      treasuryId,
      "withdrawal",
      record.net_salary,
      record.currency,
      `صرف راتب شهر ${record.month} للموظف ${emp.name}`,
      `PAY-${record.id.substring(4, 9).toUpperCase()}`,
    );
    if (record.loan_deduction > 0 && this.state.loans) {
      const activeLoan = this.state.loans.find(
        (l) => l.employee_id === emp.id && l.status === "active",
      );
      if (activeLoan) {
        let repayAmt = record.loan_deduction;
        if (activeLoan.currency && activeLoan.currency !== record.currency) {
          const rateSalary = this.getExchangeRate(record.currency);
          const rateLoan = this.getExchangeRate(activeLoan.currency);
          repayAmt = (record.loan_deduction * rateSalary) / (rateLoan || 1);
        }
        this.repayLoan(activeLoan.id, repayAmt);
      }
    }
    record.status = "paid";
    record.payment_date = /* @__PURE__ */ new Date().toISOString().split("T")[0];
    record.payment_treasury_id = treasuryId;
    this.saveState();
    this.logAction(
      "HR",
      "صرف راتب موظف",
      `تم صرف راتب الموظف ${emp.name} بقيمة ${record.net_salary} ${record.currency}`,
      "TRANSACTION",
    );
  }
  disburseLoan(loanId: string, treasuryId: string) {
    if (!this.state.loans) this.state.loans = [];
    const loan = this.state.loans.find((l) => l.id === loanId);
    if (!loan) throw new Error("السلفة غير موجودة");
    const emp = this.state.employees?.find((e) => e.id === loan.employee_id);
    const tr = this.state.treasuries?.find((t) => t.id === treasuryId);
    if (!tr) throw new Error("الخزينة غير موجودة");

    loan.treasury_id = treasuryId;
    const ref = `LOAN-${loan.id.slice(-6).toUpperCase()}`;

    const hasTx = (this.state.treasuryTransactions || []).some(
      (t) => t.reference === ref || t.related_entity_id === loan.id,
    );

    if (!hasTx) {
      this.addTreasuryTransaction(
        treasuryId,
        "withdrawal",
        loan.amount,
        loan.currency,
        `صرف سلفة نقداً للموظف ${emp?.name || ""} (${loan.notes || ""})`,
        ref,
      );

      const loanAccCode =
        (this.state.accounts || []).find(
          (a) => a.code === "15010240" || a.code === "103000" || a.name_ar.includes("سلف"),
        )?.code || "15010240";

      const treasuryAccCode =
        tr.account_code ||
        (tr.type === "bank" ? "102000" : tr.branch_id === "branch-2" ? "101001" : "101000");

      const rate = this.getExchangeRate(loan.currency);

      const journalLines = [
        {
          account_code: loanAccCode,
          debit: loan.amount,
          credit: 0,
          currency: loan.currency,
          rate: rate,
          description: `إثبات سلفة نقدية للموظف ${emp?.name || ""}`,
        },
        {
          account_code: treasuryAccCode,
          debit: 0,
          credit: loan.amount,
          currency: loan.currency,
          rate: rate,
          description: `صرف سلفة من خزينة ${tr.name_ar}`,
        },
      ];

      this.addJournalEntry(
        `صرف سلفة نقدية للموظف ${emp?.name || ""}`,
        journalLines,
        ref,
        loan.currency,
        loan.date || new Date().toISOString().split("T")[0],
      );
    }

    loan.status = "active";
    this.recalculateAccountBalances();
    this.saveState();
    this.logAction(
      "HR",
      "صرف سلفة موظف",
      `تم صرف سلفة للموظف ${emp?.name || ""} بقيمة ${loan.amount} ${loan.currency} من خزينة ${tr.name_ar}`,
      "TRANSACTION",
    );
    this.notify();
  }
  postPayrollAccrualJournal(monthStr?: string) {
    const month = monthStr || new Date().toISOString().slice(0, 7);
    if (!this.state.payrolls || this.state.payrolls.filter((p) => p.month === month).length === 0) {
      this.generatePayroll(month);
    }

    const monthPayrolls = (this.state.payrolls || []).filter((p) => p.month === month);
    if (monthPayrolls.length === 0) {
      throw new Error(`لا يوجد موظفين لتوليد قيد استحقاق المرتبات لشهر ${month}`);
    }

    const payrollsByCurrency: Record<
      string,
      {
        totalBasic: number;
        totalDeductions: number;
        totalLoans: number;
        totalNet: number;
      }
    > = {};

    monthPayrolls.forEach((p) => {
      const curr = (p.currency || "USD").toUpperCase();
      if (!payrollsByCurrency[curr]) {
        payrollsByCurrency[curr] = {
          totalBasic: 0,
          totalDeductions: 0,
          totalLoans: 0,
          totalNet: 0,
        };
      }
      payrollsByCurrency[curr].totalBasic += Number(p.basic_salary || 0);
      payrollsByCurrency[curr].totalDeductions += Number(p.deductions || 0);
      payrollsByCurrency[curr].totalLoans += Number(p.loan_deduction || 0);
      payrollsByCurrency[curr].totalNet += Number(p.net_salary || 0);
    });

    const targetDate = `${month}-28`;
    const createdEntries: any[] = [];

    const expenseAcc =
      this.state.accounts.find(
        (a) =>
          a.code === "501000" ||
          a.code === "501001" ||
          a.code === "502000" ||
          a.name_ar.includes("مرتبات") ||
          a.name_ar.includes("أجور"),
      )?.code || "501000";

    const loanAcc =
      this.state.accounts.find(
        (a) => a.code === "103000" || a.code === "15010240" || a.name_ar.includes("سلف"),
      )?.code || "103000";

    const payableAcc =
      this.state.accounts.find(
        (a) => a.code === "201200" || a.code === "202000" || a.name_ar.includes("مستحق"),
      )?.code || "201200";

    for (const [curr, totals] of Object.entries(payrollsByCurrency)) {
      if (totals.totalBasic <= 0) continue;
      const rate = this.getExchangeRate(curr);

      const lines: any[] = [];
      lines.push({
        account_code: expenseAcc,
        debit: totals.totalBasic,
        credit: 0,
        currency: curr,
        rate,
        description: `إجمالي استحقاق مرتبات وأجور الموظفين لشهر ${month}`,
      });

      if (totals.totalLoans > 0) {
        lines.push({
          account_code: loanAcc,
          debit: 0,
          credit: totals.totalLoans,
          currency: curr,
          rate,
          description: `استقطاع سلف الموظفين لشهر ${month}`,
        });
      }

      if (totals.totalDeductions > 0) {
        lines.push({
          account_code: expenseAcc,
          debit: 0,
          credit: totals.totalDeductions,
          currency: curr,
          rate,
          description: `خصومات وغيابات الموظفين لشهر ${month}`,
        });
      }

      lines.push({
        account_code: payableAcc,
        debit: 0,
        credit: totals.totalNet,
        currency: curr,
        rate,
        description: `صافي المرتبات والأجور المستحقة لشهر ${month}`,
      });

      const entryDesc = `قيد استحقاق رواتب وأجور شهر ${month} (${curr})`;
      const customId = `PAYROLL-ACCRUAL-${month}-${curr}`;

      this.state.journalEntries = (this.state.journalEntries || []).filter(
        (je) => je.id !== customId,
      );

      const entry = this.addJournalEntry(entryDesc, lines, undefined, curr, targetDate, customId);
      if (entry) createdEntries.push(entry);
    }

    this.saveState();
    this.logAction(
      "HR",
      "توليد قيد استحقاق المرتبات",
      `تم توليد قيود استحقاق المرتبات لشهر ${month} لعدد ${monthPayrolls.length} موظف بنجاح`,
      "CREATE",
    );

    return createdEntries;
  }
  payAllSalariesForMonth(month: string, treasuryId: string) {
    const pending = (this.state.payrolls || []).filter(
      (p) => p.month === month && p.status !== "paid",
    );
    if (pending.length === 0) {
      throw new Error(`لا يوجد رواتب غير مدفوعة لشهر ${month}`);
    }
    let count = 0;
    pending.forEach((p) => {
      this.paySalary(p.id, treasuryId);
      count++;
    });
    return count;
  }
  importOracleBatchData(newAccounts, newJournalEntries) {
    this.state.accounts = newAccounts.map((acc) => ({
      ...acc,
      balance: acc.initial_balance || 0,
    }));
    if (this.state.treasuries && this.state.treasuries.length > 0)
      this.state.treasuries = this.state.treasuries.map((tr) => {
        const matchedAcc = newAccounts.find(
          (acc) =>
            acc.name_ar.includes(tr.name_ar) ||
            tr.name_ar.includes(acc.name_ar) ||
            acc.name_ar.includes("خزينة") ||
            acc.name_ar.includes("صندوق") ||
            acc.name_ar.includes("ارض المول"),
        );
        return {
          ...tr,
          account_code: matchedAcc ? matchedAcc.code : tr.account_code || "101000",
        };
      });
    if (newJournalEntries && newJournalEntries.length > 0)
      this.state.journalEntries = [...newJournalEntries, ...(this.state.journalEntries || [])];
    this.recalculateAccountBalances();
    this.saveState();
    this.logAction(
      "ADMIN",
      "استيراد بيانات أوراكل الشاملة",
      `تم استيراد ${newAccounts.length} حساب من أوراكل (عبر المستويات الأربعة) وحذف الحسابات القديمة، مع الاحتفاظ بالخزائن ومطابقة أكوادها حسب شجرة الحسابات المرسلة، واستيراد ${newJournalEntries.length} قيد وحركة مالية بنجاح.`,
      "IMPORT",
    );
  }
  addMallShop(shop) {
    const newShop = {
      ...shop,
      id: "shop-" + Date.now(),
    };
    this.state.mallShops = [...(this.state.mallShops || []), newShop];
    this.saveState();
    this.logAction(
      "ADMIN",
      "إضافة محلات المول",
      `تم إضافة المحل ${newShop.name_ar} (رقم ${newShop.shop_number}) بنجاح`,
      "CREATE",
    );
  }
  getShopDescriptionString(shopId: string): string {
    if (!shopId) return "";
    const shop = (this.state.mallShops || []).find(
      (s) => s.id === shopId || s.shop_number === shopId,
    );
    if (!shop) return `محل رقم (${shopId})`;
    const shopNum = shop.shop_number || shopId;
    const shopName = shop.name_ar ? ` - ${shop.name_ar}` : "";
    const tenant = shop.tenant_name ? ` (المستأجر: ${shop.tenant_name})` : "";
    return `محل رقم [${shopNum}${shopName}]${tenant}`;
  }

  enrichJournalEntriesWithDetails() {
    if (!this.state.journalEntries || this.state.journalEntries.length === 0) return;

    this.state.journalEntries.forEach((je) => {
      // 1. Mall rental payments
      const isMallPayment =
        je.description?.includes("إيجار") ||
        je.lines?.some((l) => l.account_code === "401000" && l.description?.includes("إيجار")) ||
        (je.reference && je.reference.startsWith("REC-"));

      if (isMallPayment) {
        let payment = (this.state.mallPayments || []).find(
          (p) => p.receipt_number && p.receipt_number === je.reference,
        );

        if (!payment) {
          const entryAmount = je.lines?.find((l) => (l.debit || 0) > 0 || (l.credit || 0) > 0);
          const amtVal = Math.abs(entryAmount?.debit || entryAmount?.credit || 0);
          if (amtVal > 0) {
            payment = (this.state.mallPayments || []).find(
              (p) => Math.abs(p.amount_paid) === amtVal,
            );
          }
        }

        let shopId = payment?.shop_id;

        if (!shopId && je.description) {
          const shopObj = (this.state.mallShops || []).find(
            (s) =>
              je.description.includes(s.shop_number) ||
              (s.name_ar && je.description.includes(s.name_ar)) ||
              (s.tenant_name && je.description.includes(s.tenant_name)),
          );
          if (shopObj) shopId = shopObj.id;
        }

        if (!shopId && (this.state.mallShops || []).length > 0) {
          shopId = this.state.mallShops[0].id;
        }

        if (shopId) {
          const shopStr = this.getShopDescriptionString(shopId);
          const monthYearStr =
            payment?.month && payment?.year ? ` (شهر ${payment.month}/${payment.year})` : "";
          const isRefund = je.description?.includes("رد") || (payment && payment.amount_paid < 0);

          if (
            !je.description?.includes("محل رقم") ||
            je.description === "تحصيل دفعة إيجار للمحل" ||
            je.description.includes("تحصيل دفعة إيجار للمحل")
          ) {
            je.description = isRefund
              ? `رد مقدم/دفعة إيجار - ${shopStr}${monthYearStr}`
              : `تحصيل دفعة إيجار - ${shopStr}${monthYearStr}`;
          }

          je.lines?.forEach((line) => {
            if (
              !line.description ||
              line.description === "تحصيل دفعة إيجار للمحل" ||
              !line.description.includes("محل رقم")
            ) {
              if (line.account_code === "401000") {
                line.description = isRefund
                  ? `تسوية وتخفيض إيراد إيجار - ${shopStr}`
                  : `إثبات إيراد إيجار - ${shopStr}${monthYearStr}`;
              } else {
                line.description = isRefund
                  ? `رد دفعة إيجار من الخزينة لـ ${shopStr}`
                  : `تحصيل إيجار بالخزينة من ${shopStr}`;
              }
            }
          });
        }
      }

      // 2. Contracts
      if (je.reference?.startsWith("CNTR-") || je.description?.includes("تأمين ومقدم عقد")) {
        let shopObj = (this.state.mallShops || []).find((s) =>
          je.description?.includes(s.shop_number),
        );
        if (!shopObj && (this.state.mallShops || []).length > 0) shopObj = this.state.mallShops[0];
        if (shopObj) {
          const shopStr = this.getShopDescriptionString(shopObj.id);
          je.description = `تحصيل تأمين ومقدم عقد إيجار - ${shopStr}`;
          je.lines?.forEach((line) => {
            if (line.account_code === "201100")
              line.description = `أمانة تأمين عقد إيجار - ${shopStr}`;
            else if (line.account_code === "201200")
              line.description = `مقدم عقد إيجار محصل - ${shopStr}`;
            else line.description = `تحصيل تأمين ومقدم إيجار بالخزينة من ${shopStr}`;
          });
        }
      }

      // 3. Terminations
      if (je.reference?.startsWith("TERM-") || je.description?.includes("فسخ عقد إيجار")) {
        const shopNum = je.reference?.replace("TERM-", "");
        let shopObj = (this.state.mallShops || []).find((s) => s.shop_number === shopNum);
        if (!shopObj && (this.state.mallShops || []).length > 0) shopObj = this.state.mallShops[0];
        if (shopObj) {
          const shopStr = this.getShopDescriptionString(shopObj.id);
          je.description = `فسخ عقد إيجار ${shopStr} وتسوية التأمين والمقدم`;
          je.lines?.forEach((line) => {
            if (line.account_code === "201100")
              line.description = `تسوية أمانة تأمين عقد - ${shopStr}`;
            else line.description = `تسوية وصرف مبالغ فسخ العقد - ${shopStr}`;
          });
        }
      }
    });
  }

  createMallContract(shopId, updates, treasuryId) {
    this.updateMallShop(shopId, updates);
    const contract = updates.contract;
    if (contract && treasuryId) {
      const treasury = this.state.treasuries.find((t) => t.id === treasuryId);
      if (treasury) {
        const treasuryAccountCode =
          treasury.account_code ||
          (treasury.type === "bank"
            ? "102000"
            : treasury.branch_id === "branch-2"
              ? "101001"
              : "101000");
        const totalCollected = (contract.deposit_amount || 0) + (contract.advance_payment || 0);
        if (totalCollected > 0) {
          const shopStr = this.getShopDescriptionString(shopId);
          const curr = (contract.currency || treasury.currency || "USD").toUpperCase();
          const rate = this.getExchangeRate(curr);
          const entryDesc = `تحصيل تأمين ومقدم عقد إيجار - ${shopStr}`;
          const lines = [
            {
              account_code: treasuryAccountCode,
              debit: totalCollected,
              credit: 0,
              currency: curr,
              rate: rate,
              description: `تحصيل تأمين ومقدم إيجار بخزينة ${treasury.name_ar} من ${shopStr}`,
            },
          ];
          if (contract.deposit_amount > 0)
            lines.push({
              account_code: "201100",
              debit: 0,
              credit: contract.deposit_amount,
              currency: curr,
              rate: rate,
              description: `أمانة تأمين عقد إيجار - ${shopStr}`,
            });
          if (contract.advance_payment > 0)
            lines.push({
              account_code: "201200",
              debit: 0,
              credit: contract.advance_payment,
              currency: curr,
              rate: rate,
              description: `مقدم عقد إيجار محصل لحساب عقد - ${shopStr}`,
            });
          this.addJournalEntry(
            entryDesc,
            lines,
            `CNTR-${Date.now().toString().slice(-6)}`,
            curr,
            contract.start_date,
          );
          this.addTreasuryTransaction(
            treasuryId,
            "sales",
            totalCollected,
            curr,
            entryDesc,
            `CNTR-${Date.now().toString().slice(-6)}`,
            "cash",
            null,
          );
        }
      }
    }
  }
  updateMallShop(id, updates) {
    this.state.mallShops = (this.state.mallShops || []).map((s) =>
      s.id === id
        ? {
            ...s,
            ...updates,
          }
        : s,
    );
    this.saveState();
    this.logAction("ADMIN", "تعديل بيانات المحل", `تم تحديث بيانات المحل رقم ${id}`, "UPDATE");
  }
  deleteMallShop(id) {
    this.state.mallShops = (this.state.mallShops || []).filter((s) => s.id !== id);
    this.state.mallPayments = (this.state.mallPayments || []).filter((p) => p.shop_id !== id);
    this.saveState();
    this.logAction("ADMIN", "حذف محل من المول", `تم حذف المحل وسجل مدفوعاته`, "DELETE");
  }
  recordMallPayment(payment, treasuryId) {
    const existingIndex = (this.state.mallPayments || []).findIndex(
      (p) => p.shop_id === payment.shop_id && p.year === payment.year && p.month === payment.month,
    );
    if (existingIndex >= 0)
      this.state.mallPayments[existingIndex] = {
        ...this.state.mallPayments[existingIndex],
        ...payment,
      };
    else {
      const newPayment = {
        ...payment,
        id: "pay-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      };
      this.state.mallPayments = [...(this.state.mallPayments || []), newPayment];
    }

    const shopStr = this.getShopDescriptionString(payment.shop_id);
    const monthYearStr = `شهر ${payment.month}/${payment.year}`;
    const notesStr = payment.notes ? ` - ملاحظات: ${payment.notes}` : "";

    this.saveState();
    this.logAction(
      "ADMIN",
      "تسجيل دفعة إيجار",
      `تم تسجيل دفعة إيجار لـ ${shopStr} لـ ${monthYearStr} بقيمة ${payment.amount_paid}`,
      "TRANSACTION",
    );
    if (treasuryId && payment.amount_paid !== 0) {
      const treasury = this.state.treasuries.find((t) => t.id === treasuryId);
      if (treasury) {
        const treasuryAccountCode =
          treasury.account_code ||
          (treasury.type === "bank"
            ? "102000"
            : treasury.branch_id === "branch-2"
              ? "101001"
              : "101000");
        const isRefund = payment.amount_paid < 0;
        const absAmount = Math.abs(payment.amount_paid);
        const curr = (payment.currency || treasury.currency || "USD").toUpperCase();
        const rate = this.getExchangeRate(curr);

        const entryDesc = isRefund
          ? `رد مقدم/دفعة إيجار - ${shopStr} (${monthYearStr})${notesStr}`
          : `تحصيل دفعة إيجار - ${shopStr} (${monthYearStr})${notesStr}`;

        const lines = [
          {
            account_code: treasuryAccountCode,
            debit: isRefund ? 0 : absAmount,
            credit: isRefund ? absAmount : 0,
            currency: curr,
            rate: rate,
            description: isRefund
              ? `رد دفعة إيجار من خزينة ${treasury.name_ar} لـ ${shopStr}`
              : `تحصيل إيجار بخزينة ${treasury.name_ar} من ${shopStr}`,
          },
          {
            account_code: "401000",
            debit: isRefund ? absAmount : 0,
            credit: isRefund ? 0 : absAmount,
            currency: curr,
            rate: rate,
            description: isRefund
              ? `تسوية وتخفيض إيراد إيجار - ${shopStr}`
              : `إثبات إيراد إيجار - ${shopStr} عن ${monthYearStr}`,
          },
        ];
        this.addJournalEntry(
          entryDesc,
          lines,
          payment.receipt_number || `REC-${Date.now()}`,
          curr,
          payment.payment_date || /* @__PURE__ */ new Date().toISOString().split("T")[0],
        );
        this.addTreasuryTransaction(
          treasuryId,
          isRefund ? "withdrawal" : "sales",
          absAmount,
          curr,
          entryDesc,
          payment.receipt_number || `REC-${Date.now()}`,
          payment.payment_method === "cash" ? "cash" : "bank_transfer",
          null,
        );
      }
    }
  }
  deleteMallPayment(id) {
    this.state.mallPayments = (this.state.mallPayments || []).filter((p) => p.id !== id);
    this.saveState();
    this.logAction("ADMIN", "حذف دفعة إيجار", `تم حذف دفعة الإيجار رقم ${id}`, "DELETE");
  }
  addMallGardenRevenue(rev) {
    const newRev = {
      ...rev,
      id: "rev-" + Date.now(),
    };
    this.state.mallGardenRevenues = [...(this.state.mallGardenRevenues || []), newRev];
    this.saveState();
    this.logAction("ADMIN", "إضافة إيراد حديقة", `تم إضافة إيراد بقيمة ${newRev.amount}`, "CREATE");

    if (rev.treasury_id && rev.amount > 0) {
      const treasury = (this.state.treasuries || []).find((t) => t.id === rev.treasury_id);
      if (treasury) {
        const treasuryAccountCode =
          treasury.account_code || (treasury.type === "bank" ? "102000" : "101000");
        const curr = (treasury.currency || "USD").toUpperCase();
        const rate = this.getExchangeRate(curr);

        let revAccountCode = "401000"; // default sales revenue
        if (rev.category === "garden_ticket")
          revAccountCode = "401000"; // Can use a more specific revenue account if available
        else if (rev.category === "parking") revAccountCode = "401000";
        else revAccountCode = "401000";

        const entryDesc = `تحصيل إيراد حديقة - ${rev.description}`;

        const lines = [
          {
            account_code: treasuryAccountCode,
            debit: rev.amount,
            credit: 0,
            currency: curr,
            rate: rate,
            description: entryDesc,
          },
          {
            account_code: revAccountCode,
            debit: 0,
            credit: rev.amount,
            currency: curr,
            rate: rate,
            description: entryDesc,
          },
        ];

        this.addJournalEntry(
          entryDesc,
          lines,
          rev.receipt_number || `REC-G-${Date.now()}`,
          curr,
          rev.date || new Date().toISOString().split("T")[0],
        );

        this.addTreasuryTransaction(
          rev.treasury_id,
          "sales",
          rev.amount,
          curr,
          entryDesc,
          rev.receipt_number || `REC-G-${Date.now()}`,
          "cash",
          null,
        );
      }
    }
  }
  deleteMallGardenRevenue(id) {
    this.state.mallGardenRevenues = (this.state.mallGardenRevenues || []).filter(
      (r) => r.id !== id,
    );
    this.saveState();
    this.logAction("ADMIN", "حذف إيراد حديقة", `تم حذف الإيراد رقم ${id}`, "DELETE");
  }
  addMallGardenExpense(exp) {
    const newExp = {
      ...exp,
      id: "exp-" + Date.now(),
    };
    this.state.mallGardenExpenses = [...(this.state.mallGardenExpenses || []), newExp];
    this.saveState();
    this.logAction(
      "ADMIN",
      "إضافة مصروف مول/حديقة",
      `تم إضافة مصروف ${newExp.title} بقيمة ${newExp.amount}`,
      "CREATE",
    );

    if (exp.treasury_id && exp.amount > 0) {
      const treasury = (this.state.treasuries || []).find((t) => t.id === exp.treasury_id);
      if (treasury) {
        const treasuryAccountCode =
          treasury.account_code || (treasury.type === "bank" ? "102000" : "101000");
        const curr = (treasury.currency || "USD").toUpperCase();
        const rate = this.getExchangeRate(curr);

        const expAccountCode = "502000"; // generic expense for salary or 503000 for maintenance. Let's use 502000 as default placeholder, since it's just generic.

        const entryDesc = `دفع مصروف حديقة/مول - ${exp.title} - ${exp.paid_to || ""}`;

        const lines = [
          {
            account_code: expAccountCode,
            debit: exp.amount,
            credit: 0,
            currency: curr,
            rate: rate,
            description: entryDesc,
          },
          {
            account_code: treasuryAccountCode,
            debit: 0,
            credit: exp.amount,
            currency: curr,
            rate: rate,
            description: entryDesc,
          },
        ];

        this.addJournalEntry(
          entryDesc,
          lines,
          `EXP-G-${Date.now()}`,
          curr,
          exp.date || new Date().toISOString().split("T")[0],
        );

        this.addTreasuryTransaction(
          exp.treasury_id,
          "expense",
          exp.amount,
          curr,
          entryDesc,
          `EXP-G-${Date.now()}`,
          "cash",
          null,
        );
      }
    }
  }
  deleteMallGardenExpense(id) {
    this.state.mallGardenExpenses = (this.state.mallGardenExpenses || []).filter(
      (e) => e.id !== id,
    );
    this.saveState();
    this.logAction("ADMIN", "حذف مصروف", `تم حذف المصروف رقم ${id}`, "DELETE");
  }
  resetMallData() {
    this.state.mallShops = DEFAULT_MALL_SHOPS;
    this.state.mallPayments = DEFAULT_MALL_PAYMENTS;
    this.state.mallGardenRevenues = DEFAULT_GARDEN_REVENUES;
    this.state.mallGardenExpenses = DEFAULT_GARDEN_EXPENSES;
    this.state.mallTerminatedContractsArchive = [];
    this.saveState();
    this.logAction(
      "ADMIN",
      "إعادة ضبط بيانات المول",
      "تم إعادة تحميل بيانات المحلات والإيجارات الافتراضية بنجاح",
      "UPDATE",
    );
  }
  terminateMallContract(record, treasuryId) {
    const termRecord = {
      ...record,
      id: "term-" + Date.now(),
    };
    this.state.mallTerminatedContractsArchive = [
      termRecord,
      ...(this.state.mallTerminatedContractsArchive || []),
    ];
    const shop = (this.state.mallShops || []).find((s) => s.id === record.shop_id);
    if (shop) {
      shop.status = "vacant";
      shop.tenant_name = "";
      shop.phone = "";
      shop.contract = void 0;
    }
    let treasuryAccountCode = "101000";
    if (treasuryId) {
      const treasury = this.state.treasuries.find((t) => t.id === treasuryId);
      if (treasury)
        treasuryAccountCode =
          treasury.account_code ||
          (treasury.type === "bank"
            ? "102000"
            : treasury.branch_id === "branch-2"
              ? "101001"
              : "101000");
    }
    const shopStr = this.getShopDescriptionString(record.shop_id || record.shop_number);
    const refundAmount = record.refund_amount || 0;
    const depositAmount = record.deposit_amount || 0;

    const entryDesc = `فسخ عقد إيجار ${shopStr} وتسوية التأمين والمقدم`;

    if (refundAmount > 0 && treasuryId)
      this.addTreasuryTransaction(
        treasuryId,
        "withdrawal",
        refundAmount,
        "USD",
        `رد تأمين لفسخ عقد إيجار - ${shopStr}`,
        `TERM-${record.shop_number}`,
        "cash",
        null,
      );
    if (depositAmount > 0 || refundAmount > 0) {
      const lines = [];
      if (depositAmount > 0)
        lines.push({
          account_code: "201100",
          debit: depositAmount,
          credit: 0,
          description: `تسوية أمانة تأمين عقد - ${shopStr}`,
        });
      if (refundAmount > 0)
        lines.push({
          account_code: treasuryAccountCode,
          debit: 0,
          credit: refundAmount,
          description: `صرف رد التأمين نقداً من خزينة ${treasuryAccountCode} لـ ${shopStr}`,
        });
      const diff = depositAmount - refundAmount;
      if (diff > 0)
        lines.push({
          account_code: "401000",
          debit: 0,
          credit: diff,
          description: `إثبات تسوية متبقي التأمين كإيراد عند فسخ عقد ${shopStr}`,
        });
      else if (diff < 0)
        lines.push({
          account_code: "501000",
          debit: Math.abs(diff),
          credit: 0,
          description: `إثبات الفارق كمصروف تسوية عند فسخ عقد ${shopStr}`,
        });
      this.addJournalEntry(
        entryDesc,
        lines,
        `TERM-${record.shop_number}`,
        "USD",
        record.termination_date,
      );
    }
    this.saveState();
    this.logAction(
      "ADMIN",
      "فسخ عقد إيجار محل",
      `تم فسخ عقد المحل #${record.shop_number} وأرشفة العقد ورد التأمين بقيمة ${record.refund_amount} USD`,
      "UPDATE",
    );
  }

  postMallRentAccrualJournal(monthStr?: string) {
    const month = monthStr || new Date().toISOString().slice(0, 7);

    // 1. Check if accrual entry already exists for this month
    const existingEntry = (this.state.journalEntries || []).find(
      (je) =>
        je.reference === `MALL-RENT-ACCRUAL-${month}` ||
        je.reference?.startsWith(`MALL-RENT-ACCRUAL-${month}`) ||
        je.description?.includes(`قيد استحقاق إيجارات المحلات لشهر (${month})`) ||
        je.description?.includes(`قيد استحقاق إيجارات المحلات - شهر (${month})`) ||
        je.description?.includes(`استحقاق إيجار المحلات لشهر ${month}`) ||
        je.description?.includes(`MALL-RENT-ACCRUAL-${month}`),
    );

    if (existingEntry) {
      return {
        success: false,
        alreadyGenerated: true,
        message: `تنبيه: تم توليد قيود استحقاق إيجار المحلات لشهر (${month}) مسبقاً! لا يمكن إعادة التوليد لنفس الشهر. (مرجع القيد: ${existingEntry.reference || existingEntry.id})`,
      };
    }

    // 2. Find active rented shops
    const rentedShops = (this.state.mallShops || []).filter(
      (s) => s.status === "rented" && Number(s.monthly_rent || 0) > 0,
    );

    if (rentedShops.length === 0) {
      return {
        success: false,
        alreadyGenerated: false,
        message: `لا توجد محلات مؤجرة بقيمة إيجارية لتوليد قيود الاستحقاق لشهر (${month}).`,
      };
    }

    // Receivable account for Mall Tenants (ذمم مدينة - مستأجري المحلات)
    const receivableAcc =
      this.state.accounts?.find(
        (a) =>
          a.code === "120100" ||
          a.code === "103001" ||
          a.name_ar.includes("مستأجر") ||
          a.name_ar.includes("إيجار"),
      )?.code || "120100";

    if (!this.state.accounts.some((a) => a.code === receivableAcc)) {
      this.state.accounts.push({
        id: `acc-${Date.now()}-120100`,
        code: "120100",
        name_ar: "ذمم مدينة - مستأجري المحلات",
        type: "asset",
        category: "current_assets",
        balance: 0,
        initial_balance: 0,
        status: "active",
        system_binding: "none",
      });
    }

    const revenueAcc = "401000";

    // Group rented shops by currency
    const shopsByCurrency: Record<string, typeof rentedShops> = {};
    rentedShops.forEach((s) => {
      const curr = (s.contract?.currency || "USD").toUpperCase();
      if (!shopsByCurrency[curr]) shopsByCurrency[curr] = [];
      shopsByCurrency[curr].push(s);
    });

    const targetDate = `${month}-01`;
    const createdEntries: any[] = [];
    let totalGrandRent = 0;

    for (const [curr, shopList] of Object.entries(shopsByCurrency)) {
      const rate = this.getExchangeRate(curr);
      const lines: any[] = [];
      let currTotalRent = 0;

      shopList.forEach((s) => {
        const rentAmt = Number(s.monthly_rent || 0);
        currTotalRent += rentAmt;
        const shopStr = this.getShopDescriptionString(s.id);

        lines.push({
          account_code: receivableAcc,
          debit: rentAmt,
          credit: 0,
          currency: curr,
          rate,
          description: `استحقاق إيجار ${shopStr} عن شهر (${month})`,
        });

        lines.push({
          account_code: revenueAcc,
          debit: 0,
          credit: rentAmt,
          currency: curr,
          rate,
          description: `إثبات إيراد إيجار مستحق لـ ${shopStr} عن شهر (${month})`,
        });
      });

      totalGrandRent += currTotalRent;

      const entryDesc = `قيد استحقاق إيجارات المحلات لشهر (${month}) - عدد المحلات (${shopList.length})`;
      const ref = `MALL-RENT-ACCRUAL-${month}`;
      const customId = `JE-MALL-ACCRUAL-${month}-${curr}`;

      const entry = this.addJournalEntry(entryDesc, lines, ref, curr, targetDate, customId);
      if (entry) createdEntries.push(entry);
    }

    this.saveState();
    this.logAction(
      "ADMIN",
      "توليد قيد استحقاق الإيجارات",
      `تم توليد قيود استحقاق إيجار المحلات لشهر ${month} لعدد ${rentedShops.length} محل بنجاح`,
      "CREATE",
    );

    return {
      success: true,
      alreadyGenerated: false,
      message: `تم توليد قيود استحقاق الإيجار لشهر (${month}) بنجاح لعدد (${rentedShops.length}) محل بقيمة إجمالية $${totalGrandRent.toLocaleString()}`,
      count: rentedShops.length,
      totalRent: totalGrandRent,
      entries: createdEntries,
    };
  }

  // ==========================================
  // PARK TICKETS & POS MANAGEMENT METHODS
  // ==========================================

  getParkTicketItems(): ParkTicketItem[] {
    return this.state.parkTicketItems || DEFAULT_PARK_TICKET_ITEMS;
  }

  addParkTicketItem(item: Partial<ParkTicketItem>) {
    const newItem: ParkTicketItem = {
      id: "park-tkt-" + Date.now(),
      name_ar: item.name_ar || "تذكرة جديدة",
      name_en: item.name_en || "",
      type: item.type || "custom",
      price_usd: Number(item.price_usd) || 5,
      persons_count: Number(item.persons_count) || 1,
      is_active: item.is_active !== undefined ? item.is_active : true,
    };
    this.state.parkTicketItems = [
      ...(this.state.parkTicketItems || DEFAULT_PARK_TICKET_ITEMS),
      newItem,
    ];
    this.saveState();
    this.logAction(
      "ADMIN",
      "إضافة نوع تذكرة",
      `تم إضافة تذكرة ${newItem.name_ar} بسعر $${newItem.price_usd}`,
      "CREATE",
    );
    return newItem;
  }

  updateParkTicketItem(id: string, updates: Partial<ParkTicketItem>) {
    this.state.parkTicketItems = (this.state.parkTicketItems || DEFAULT_PARK_TICKET_ITEMS).map(
      (t) => (t.id === id ? { ...t, ...updates } : t),
    );
    this.saveState();
    this.logAction("ADMIN", "تحديث تذكرة", `تم تحديث بيانات التذكرة رقم ${id}`, "UPDATE");
  }

  deleteParkTicketItem(id: string) {
    const item = (this.state.parkTicketItems || DEFAULT_PARK_TICKET_ITEMS).find((t) => t.id === id);
    this.state.parkTicketItems = (this.state.parkTicketItems || DEFAULT_PARK_TICKET_ITEMS).filter(
      (t) => t.id !== id,
    );
    this.saveState();
    this.logAction("ADMIN", "حذف نوع تذكرة", `تم حذف التذكرة ${item?.name_ar || id}`, "DELETE");
  }

  getParkCustomers(): ParkCustomer[] {
    return this.state.parkCustomers || DEFAULT_PARK_CUSTOMERS;
  }

  getParkTicketTransactions(): ParkTicketTransaction[] {
    return this.state.parkTicketTransactions || [];
  }

  getJournalEntries(): JournalEntry[] {
    return this.state.journalEntries || [];
  }

  addParkCustomer(customer: Partial<ParkCustomer>) {
    const newCust: ParkCustomer = {
      id: "cust-park-" + Date.now(),
      name_ar: customer.name_ar || "عميل جديد",
      phone: customer.phone || "",
      company: customer.company || "",
      notes: customer.notes || "",
    };
    this.state.parkCustomers = [...(this.state.parkCustomers || DEFAULT_PARK_CUSTOMERS), newCust];
    this.saveState();
    this.logAction("ADMIN", "إضافة عميل تذاكر", `تم إضافة العميل ${newCust.name_ar}`, "CREATE");
    return newCust;
  }

  updateParkCustomer(id: string, updates: Partial<ParkCustomer>) {
    this.state.parkCustomers = (this.state.parkCustomers || DEFAULT_PARK_CUSTOMERS).map((c) =>
      c.id === id ? { ...c, ...updates } : c,
    );
    this.saveState();
  }

  deleteParkCustomer(id: string) {
    this.state.parkCustomers = (this.state.parkCustomers || DEFAULT_PARK_CUSTOMERS).filter(
      (c) => c.id !== id,
    );
    this.saveState();
  }

  getParkOperationalTreasuries(): ParkOperationalTreasury[] {
    return this.state.parkOperationalTreasuries || DEFAULT_PARK_OPERATIONAL_TREASURIES;
  }

  updateParkOperationalTreasuryLink(id: string, realTreasuryId: string) {
    this.state.parkOperationalTreasuries = (
      this.state.parkOperationalTreasuries || DEFAULT_PARK_OPERATIONAL_TREASURIES
    ).map((t) => (t.id === id ? { ...t, linked_real_treasury_id: realTreasuryId } : t));
    this.saveState();
    this.logAction(
      "ADMIN",
      "ربط خزينة تشغيلية",
      `تم ربط الخزينة ${id} بالخزينة الحقيقية ${realTreasuryId}`,
      "UPDATE",
    );
  }

  generateUniqueParkShiftNumber(): string {
    const todayStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const shifts = this.state.parkShifts || [];
    let count =
      shifts.filter((s) => s.auto_shift_number?.includes(todayStr) || s.id?.includes(todayStr))
        .length + 1;
    let candidate = `PSH-${todayStr}-${count.toString().padStart(3, "0")}`;
    while (shifts.some((s) => s.auto_shift_number === candidate || s.id === candidate)) {
      count++;
      candidate = `PSH-${todayStr}-${count.toString().padStart(3, "0")}`;
    }
    return candidate;
  }

  getParkShifts(): ParkShift[] {
    return this.state.parkShifts || [];
  }

  getActiveParkShift(): ParkShift | null {
    if (this.state.parkActiveShift && this.state.parkActiveShift.status === "open") {
      return this.state.parkActiveShift;
    }
    return null;
  }

  setActiveParkShift(shiftId: string): ParkShift {
    const shift = (this.state.parkShifts || []).find((s) => s.id === shiftId);
    if (!shift) throw new Error("الوردية غير موجودة!");
    this.state.parkActiveShift = shift;
    this.saveState();
    shiftAuditService.logShiftAction({
      shift_id: shift.id,
      shift_type: "park",
      shift_number: shift.shift_number,
      auto_shift_number: shift.auto_shift_number,
      action: "ACTIVATE",
      status_before: shift.status,
      status_after: shift.status,
      cashier_name: shift.cashier_name,
      performed_by: this.state.currentUser || shift.cashier_name,
      details: `تم تعيين وردية التذاكر كنشطة للجلسة: ${shift.shift_number}`,
    });
    this.notify();
    return shift;
  }

  startNewParkShift(payload: {
    shift_number?: string;
    auto_shift_number?: string;
    cashier_name: string;
    notes?: string;
  }): ParkShift {
    const autoNum = payload.auto_shift_number || this.generateUniqueParkShiftNumber();
    const finalShiftNum =
      payload.shift_number && payload.shift_number.trim()
        ? payload.shift_number.trim()
        : `وردية تذاكر #${(this.state.parkShifts?.length || 0) + 1} - ${new Date().toLocaleDateString("ar-EG")}`;

    const newShift: ParkShift = {
      id: "shift-park-" + Date.now(),
      auto_shift_number: autoNum,
      shift_number: finalShiftNum,
      start_at: new Date().toISOString(),
      status: "open",
      cashier_name: payload.cashier_name || "أمين الصندوق",
      notes: payload.notes,
    };

    this.state.parkActiveShift = newShift;
    this.state.parkShifts = [newShift, ...(this.state.parkShifts || [])];
    this.saveState();

    shiftAuditService.logShiftAction({
      shift_id: newShift.id,
      shift_type: "park",
      shift_number: newShift.shift_number,
      auto_shift_number: newShift.auto_shift_number,
      action: "OPEN",
      status_before: null,
      status_after: "open",
      cashier_name: newShift.cashier_name,
      performed_by: this.state.currentUser || newShift.cashier_name,
      details: `تم افتتاح وردية تذاكر جديدة (${finalShiftNum} - رقم تلقائي: ${autoNum}) باسم: ${newShift.cashier_name}`,
      metadata: {
        notes: payload.notes,
        start_at: newShift.start_at,
      },
    });

    this.logAction(
      "POS",
      "افتتاح وردية تذاكر",
      `تم فتح وردية جديدة (${finalShiftNum} - رقم تلقائي: ${autoNum}) باسم: ${newShift.cashier_name}`,
      "CREATE",
    );
    this.notify();
    return newShift;
  }

  updateParkShift(shiftId: string, updates: Partial<ParkShift>): ParkShift {
    const shifts = this.state.parkShifts || [];
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) throw new Error("الوردية غير موجودة!");

    const oldName = shift.shift_number;
    Object.assign(shift, updates);

    // If active shift matches, update active shift as well
    if (this.state.parkActiveShift && this.state.parkActiveShift.id === shiftId) {
      Object.assign(this.state.parkActiveShift, updates);
    }

    // If shift number changed, sync open transactions
    if (updates.shift_number && updates.shift_number !== oldName) {
      (this.state.parkTicketTransactions || []).forEach((t) => {
        if (t.shift_id === shiftId) {
          t.shift_number = updates.shift_number!;
        }
      });
    }

    this.saveState();

    shiftAuditService.logShiftAction({
      shift_id: shift.id,
      shift_type: "park",
      shift_number: shift.shift_number,
      auto_shift_number: shift.auto_shift_number,
      action: "UPDATE",
      status_before: shift.status,
      status_after: shift.status,
      cashier_name: shift.cashier_name,
      performed_by: this.state.currentUser || shift.cashier_name,
      details: `تم تعديل بيانات وردية التذاكر (${shift.shift_number})`,
      metadata: updates,
    });

    this.logAction(
      "POS",
      "تعديل بيانات وردية",
      `تم تعديل بيانات الوردية (${shift.shift_number})`,
      "UPDATE",
    );
    this.notify();
    return shift;
  }

  updateParkTicketTransaction(
    txId: string,
    updates: Partial<ParkTicketTransaction>,
  ): ParkTicketTransaction {
    const txs = this.state.parkTicketTransactions || [];
    const tx = txs.find((t) => t.id === txId || t.tx_number === txId);
    if (!tx) throw new Error("معاملة التذاكر غير موجودة!");

    Object.assign(tx, updates);
    this.saveState();
    this.logAction(
      "POS",
      "تعديل معاملة تذاكر",
      `تم تعديل بيانات معاملة التذاكر (${tx.tx_number})`,
      "UPDATE",
    );
    this.notify();
    return tx;
  }

  deleteParkShift(shiftId: string): boolean {
    const shifts = this.state.parkShifts || [];
    const shift = shifts.find(
      (s) => s.id === shiftId || s.shift_number === shiftId || s.auto_shift_number === shiftId,
    );

    // Remove from array safely
    this.state.parkShifts = shifts.filter(
      (s) => s.id !== shiftId && s.shift_number !== shiftId && s.auto_shift_number !== shiftId,
    );

    if (
      this.state.parkActiveShift?.id === shiftId ||
      this.state.parkActiveShift?.shift_number === shiftId
    ) {
      this.state.parkActiveShift = null;
    }

    // Remove associated transactions that belong to this shift
    let removedTxsCount = 0;
    if (this.state.parkTicketTransactions) {
      const initialCount = this.state.parkTicketTransactions.length;
      this.state.parkTicketTransactions = this.state.parkTicketTransactions.filter(
        (tx) => tx.shift_id !== shiftId && tx.shift_number !== shiftId,
      );
      removedTxsCount = initialCount - this.state.parkTicketTransactions.length;
    }

    this.saveState();
    this.saveToIDB(this.state);

    shiftAuditService.logShiftAction({
      shift_id: shiftId,
      shift_type: "park",
      shift_number: shift ? shift.shift_number : shiftId,
      auto_shift_number: shift?.auto_shift_number || null,
      action: "DELETE",
      status_before: shift?.status || "unknown",
      status_after: "deleted",
      cashier_name: shift?.cashier_name || null,
      performed_by: this.state.currentUser || "مسؤول النظام",
      details: `تم حذف وردية التذاكر (${shift ? shift.shift_number : shiftId}) من النظام مع ${removedTxsCount} معاملة تابعة`,
      metadata: {
        removed_transactions_count: removedTxsCount,
      },
    });

    if (shift) {
      this.logAction(
        "POS",
        "حذف وردية تذاكر",
        `تم حذف الوردية (${shift.shift_number}) من النظام بالكامل`,
        "DELETE",
      );
    }
    this.notify();
    return true;
  }

  resetParkSalesData(): void {
    this.state.parkShifts = [];
    this.state.parkActiveShift = null;
    this.state.parkTicketTransactions = [];
    if (this.state.parkOperationalTreasuries) {
      this.state.parkOperationalTreasuries = this.state.parkOperationalTreasuries.map((t: any) => ({
        ...t,
        balance: 0,
      }));
    }
    if (this.state.journalEntries) {
      this.state.journalEntries = this.state.journalEntries.filter((je: any) => {
        const desc = String(je.description || "");
        const ref = String(je.reference || "");
        return (
          !desc.includes("تذاكر الحديقة") &&
          !desc.includes("إغلاق وردية تذاكر") &&
          !desc.includes("ترحيل خزينة تذاكر") &&
          !desc.includes("إقفال وردية") &&
          !ref.startsWith("PK-") &&
          !ref.startsWith("REF-PK-") &&
          !ref.startsWith("SH-")
        );
      });
    }
    this.state.park_sales_hard_zero_reset_v4_2026_09_03 = true;
    this.recalculateAccountBalances();
    this.saveState();
    this.saveToIDB(this.state);
    shiftAuditService.logShiftAction({
      shift_id: "all-park-reset",
      shift_type: "park",
      shift_number: "تصفير مبيعات التذاكر",
      action: "DELETE",
      details: "تم إجراء تصفير كامل لجميع ورديات ومعاملات مبيعات التذاكر",
    });
    this.notify();
  }

  resumeParkShift(shiftId: string): ParkShift {
    const shifts = this.state.parkShifts || [];
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) throw new Error("الوردية غير موجودة!");
    if (shift.status !== "open") throw new Error("لا يمكن الدخول على وردية مغلقة!");

    this.state.parkActiveShift = shift;
    this.saveState();
    shiftAuditService.logShiftAction({
      shift_id: shift.id,
      shift_type: "park",
      shift_number: shift.shift_number,
      auto_shift_number: shift.auto_shift_number,
      action: "RESUME",
      status_before: shift.status,
      status_after: "open",
      cashier_name: shift.cashier_name,
      performed_by: this.state.currentUser || shift.cashier_name,
      details: `تم استئناف وردية التذاكر المفتوحة (${shift.shift_number}) كوردية نشطة للجلسة`,
    });
    this.notify();
    return shift;
  }

  getOrCreateActiveParkShift(): ParkShift {
    const active = this.state.parkActiveShift;
    if (!active || active.status !== "open") {
      throw new Error("لا توجد وردية مفتوحة حالياً. يرجى فتح وردية أولاً من صفحة الورديات.");
    }
    return active;
  }

  processParkTicketSale(saleData: {
    items: ParkTicketCartItem[];
    currency: "USD" | "SSP";
    exchange_rate?: number;
    payment_method: "cash" | "visa" | "bank_transfer" | "credit";
    reference_number?: string;
    manual_tx_number?: string;
    customer_id?: string;
    transaction_date?: string;
    transaction_time?: string;
    notes?: string;
  }) {
    if (!saleData.items || saleData.items.length === 0) {
      throw new Error("سلة التذاكر فارغة!");
    }

    const shift = this.getActiveParkShift();
    if (!shift || shift.status !== "open") {
      throw new Error("لا توجد وردية مفتوحة حالياً! يجب فتح وردية أولاً لتسجيل المبيعات.");
    }
    const subtotalUsd = saleData.items.reduce(
      (sum, item) => sum + item.price_usd * item.quantity,
      0,
    );
    const curr = saleData.currency || "USD";
    const baseRate = this.getExchangeRate(curr);
    const rate = curr === "SSP" ? Number(saleData.exchange_rate || baseRate) : 1;

    const totalPaidInCurrency = curr === "SSP" ? Math.round(subtotalUsd * rate) : subtotalUsd;

    let customerName = "";
    if (saleData.payment_method === "credit") {
      if (!saleData.customer_id) {
        throw new Error("يجب اختيار العميل عند الدفع الآجل!");
      }
      const cust = (this.state.parkCustomers || DEFAULT_PARK_CUSTOMERS).find(
        (c) => c.id === saleData.customer_id,
      );
      customerName = cust ? cust.name_ar : "عميل آجل";
    }

    if (saleData.payment_method === "visa" && !saleData.reference_number?.trim()) {
      throw new Error("رقم تأكيد الفيزا مطلوب وإجباري!");
    }
    if (saleData.payment_method === "bank_transfer" && !saleData.reference_number?.trim()) {
      throw new Error("رقم التحويل البنكي مطلوب وإجباري!");
    }

    const now = new Date();
    const txDate = saleData.transaction_date || now.toISOString().split("T")[0];
    const txTime = saleData.transaction_time || now.toTimeString().slice(0, 5);

    // Sequential & Unique Receipt Numbering Logic: PRK-YYYYMMDD-0001
    const existingTxs = this.state.parkTicketTransactions || [];
    const datePrefix = txDate.replace(/-/g, "");
    let seq = existingTxs.length + 1;
    let candidateTxNum = `PRK-${datePrefix}-${seq.toString().padStart(4, "0")}`;
    while (existingTxs.some((t) => t.tx_number === candidateTxNum)) {
      seq++;
      candidateTxNum = `PRK-${datePrefix}-${seq.toString().padStart(4, "0")}`;
    }
    const txNum = candidateTxNum;

    const opTreasuries = this.getParkOperationalTreasuries();
    const matchingOpTreasury =
      opTreasuries.find(
        (t) => t.payment_method === saleData.payment_method && t.currency === curr,
      ) || opTreasuries[0];

    matchingOpTreasury.balance = (matchingOpTreasury.balance || 0) + totalPaidInCurrency;

    const itemNotesArray = saleData.items
      .filter((i) => i.note && i.note.trim())
      .map((i) => `${i.name_ar} [ملاحظة: ${i.note.trim()}]`);
    const combinedNotes = itemNotesArray
      .concat(saleData.notes ? [saleData.notes.trim()] : [])
      .filter(Boolean)
      .join(" | ");

    const methodArMap: Record<string, string> = {
      cash: "نقدي",
      visa: "فيزا / بطاقة",
      bank_transfer: "تحويل بنكي",
      credit: "آجل على الحساب",
    };

    // Requirement 2: Do NOT create journal entries immediately when sale is completed.
    // Journal entries are generated automatically only when "End Shift" is executed.
    const pendingJournalRef = "معلقة - إغلاق الوردية";

    const txRecord: ParkTicketTransaction = {
      id: "tx-park-" + Date.now(),
      tx_number: txNum,
      manual_tx_number:
        saleData.manual_tx_number?.trim() || saleData.reference_number?.trim() || txNum,
      shift_id: shift.id,
      shift_number: shift.shift_number,
      items: saleData.items,
      subtotal_usd: subtotalUsd,
      total_usd: subtotalUsd,
      currency: curr,
      exchange_rate: rate, // Exact rate for this specific transaction!
      total_paid_in_currency: totalPaidInCurrency,
      payment_method: saleData.payment_method,
      reference_number: saleData.reference_number || saleData.manual_tx_number || "",
      customer_id: saleData.customer_id,
      customer_name: customerName,
      operational_treasury_id: matchingOpTreasury.id,
      linked_real_treasury_id: matchingOpTreasury.linked_real_treasury_id,
      status: "completed",
      transaction_date: txDate,
      transaction_time: txTime,
      system_timestamp: now.toISOString(),
      journal_entry_ref: pendingJournalRef,
      created_by: shift.cashier_name || this.state.currentUser || "أمين الصندوق",
      notes: combinedNotes,
    };

    this.state.parkTicketTransactions = [txRecord, ...(this.state.parkTicketTransactions || [])];

    const gardenRevRecord: MallGardenRevenue = {
      id: "rev-park-" + Date.now(),
      year: parseInt(txDate.split("-")[0], 10),
      month: parseInt(txDate.split("-")[1], 10),
      category: "garden_ticket",
      description: `تذاكر دخول الحديقة - ${txNum} (${methodArMap[saleData.payment_method]}) - Rate (المعامل): ${rate}`,
      amount: subtotalUsd,
      date: txDate,
      receipt_number: txNum,
      notes: combinedNotes,
    };
    this.state.mallGardenRevenues = [gardenRevRecord, ...(this.state.mallGardenRevenues || [])];

    this.saveState();
    this.logAction(
      "POS",
      "اصدار تذاكر حديقة",
      `تم تسجيل عملية تذاكر (${txNum}) بمبلغ ${totalPaidInCurrency} ${curr} (سيتم توليد القيد عند إغلاق الوردية)`,
      "CREATE",
    );
    return { transaction: txRecord, journalEntry: null };
  }

  refundParkTicketTransaction(txId: string, refundReason: string) {
    const tx = (this.state.parkTicketTransactions || []).find(
      (t) => t.id === txId || t.tx_number === txId,
    );
    if (!tx) throw new Error("المعاملة غير موجودة!");
    if (tx.status === "refunded") throw new Error("المعاملة تمت استعادتها/إرجاعها من قبل!");
    if (!refundReason || !refundReason.trim()) throw new Error("يجب كتابة سبب الإرجاع!");

    const opTreasuries = this.getParkOperationalTreasuries();
    const opTreasury = opTreasuries.find((t) => t.id === tx.operational_treasury_id);
    if (opTreasury) {
      opTreasury.balance = (opTreasury.balance || 0) - tx.total_paid_in_currency;
    }

    const now = new Date();
    const refundTxNum = `TX-PARK-REFUND-${Date.now().toString().slice(-6)}`;

    tx.status = "refunded";
    tx.refund_reason = refundReason;
    tx.refund_tx_id = refundTxNum;
    tx.refund_journal_ref = "معلقة - إغلاق الوردية";
    tx.refund_at = now.toISOString();

    this.saveState();
    this.logAction(
      "POS",
      "إرجاع تذاكر حديقة",
      `تم إرجاع المعاملة (${tx.tx_number}) بسبب: ${refundReason} (سيتم توليد قيد الإرجاع عند إغلاق الوردية)`,
      "DELETE",
    );
    return { transaction: tx, refundJournalEntry: null };
  }

  updateParkTicketTransactionDateTime(txId: string, newDate: string, newTime: string) {
    const txs = this.state.parkTicketTransactions || [];
    const tx = txs.find((t) => t.id === txId || t.tx_number === txId);
    if (!tx) throw new Error("المعاملة غير موجودة!");

    // Preserve tx_number and system_timestamp (immutable audit fields)
    tx.transaction_date = newDate;
    tx.transaction_time = newTime;

    // Synchronize linked journal entry date
    const je = (this.state.journalEntries || []).find(
      (j) => j.reference === tx.journal_entry_ref || j.id === tx.journal_entry_ref,
    );
    if (je) {
      je.entry_date = newDate;
    }

    // Synchronize linked garden revenue date
    const rev = (this.state.mallGardenRevenues || []).find(
      (r) => r.receipt_number === tx.tx_number,
    );
    if (rev) {
      rev.date = newDate;
      const parts = newDate.split("-");
      if (parts.length >= 2) {
        rev.year = parseInt(parts[0], 10);
        rev.month = parseInt(parts[1], 10);
      }
    }

    this.saveState();
    this.logAction(
      "POS",
      "تعديل تاريخ المعاملة",
      `تم تعديل تاريخ المعاملة (${tx.tx_number}) إلى ${newDate} ${newTime}`,
      "UPDATE",
    );
    return tx;
  }

  closeParkShift(shiftId?: string) {
    let targetShift: any = null;
    if (shiftId) {
      targetShift = (this.state.parkShifts || []).find(
        (s) => s.id === shiftId || s.shift_number === shiftId || s.auto_shift_number === shiftId,
      );
    }
    if (!targetShift) {
      targetShift = this.state.parkActiveShift;
    }
    if (!targetShift || targetShift.status !== "open") {
      targetShift = (this.state.parkShifts || []).find((s) => s.status === "open");
    }
    if (!targetShift) {
      throw new Error("لا توجد وردية مفتوحة لإغلاقها!");
    }
    const activeShift = targetShift;

    const now = new Date();
    const opTreasuries = this.getParkOperationalTreasuries();
    const destinationTransfers: Array<{
      op_treasury_id: string;
      op_treasury_name: string;
      real_treasury_id: string;
      real_treasury_name: string;
      currency: "USD" | "SSP";
      amount: number;
      journal_ref?: string;
    }> = [];

    const generatedJournalRefs: string[] = [];
    const opBalancesAtClose: Record<string, number> = {};

    const methodArMap: Record<string, string> = {
      cash: "نقدي",
      visa: "فيزا / بطاقة",
      bank_transfer: "تحويل بنكي",
      credit: "آجل على الحساب",
    };

    // Requirement 3: Generate all Park Tickets journal entries automatically ONLY when "End Shift" is executed.
    const shiftTransactions = (this.state.parkTicketTransactions || []).filter(
      (t) =>
        t.shift_id === activeShift.id ||
        !t.journal_entry_ref ||
        t.journal_entry_ref.includes("معلقة"),
    );

    shiftTransactions.forEach((tx) => {
      // Avoid duplicate journal entry creation if already posted
      if (tx.journal_entry_ref && !tx.journal_entry_ref.includes("معلقة")) {
        return;
      }

      let debitAccountCode = "101000";
      if (tx.payment_method === "visa") debitAccountCode = "102000";
      else if (tx.payment_method === "bank_transfer") debitAccountCode = "103000";
      else if (tx.payment_method === "credit") debitAccountCode = "120100";

      const opTr = opTreasuries.find((o) => o.id === tx.operational_treasury_id);
      const realTr =
        (this.state.treasuries || []).find(
          (t) => t.id === (opTr?.linked_real_treasury_id || tx.linked_real_treasury_id),
        ) || this.state.treasuries[0];

      const opTrName = opTr ? opTr.name_ar : "خزينة تشغيلية مؤقتة";
      const realTrName = realTr ? realTr.name_ar : "الخزينة الرئيسية";

      const itemNotesArray = (tx.items || [])
        .filter((i) => i.note && i.note.trim())
        .map((i) => `${i.name_ar} [ملاحظة: ${i.note.trim()}]`);
      const fullNotes = itemNotesArray
        .concat(tx.notes ? [tx.notes] : [])
        .filter(Boolean)
        .join(" | ");

      // Requirement 1 & 6 & 7: Record exact rate used for this specific transaction, item notes, operational treasury, linked real treasury, shift number, receipt number
      const entryDesc = `قيد مبيعات تذاكر الحديقة - فاتورة/إيصال (${tx.tx_number}) - وردية (${activeShift.shift_number}) - طريقة الدفع: ${methodArMap[tx.payment_method] || tx.payment_method} - العملة: ${tx.currency} - Rate (المعامل): ${tx.exchange_rate} - الخزينة التشغيلية: (${opTrName}) - الخزينة الرئيسية المرتبطة: (${realTrName})${fullNotes ? ` - ملاحظات: ${fullNotes}` : ""}`;

      const saleJE = this.addJournalEntry(
        entryDesc,
        [
          {
            account_code: debitAccountCode,
            debit: tx.total_paid_in_currency,
            credit: 0,
            currency: tx.currency,
            rate: tx.exchange_rate, // Exact rate for this specific transaction!
            description: `دفع قيمة التذاكر (${methodArMap[tx.payment_method] || tx.payment_method}) - إيصال ${tx.tx_number} - Rate (المعامل): ${tx.exchange_rate}${fullNotes ? ` [${fullNotes}]` : ""}`,
          },
          {
            account_code: "401000",
            debit: 0,
            credit: tx.total_paid_in_currency,
            currency: tx.currency,
            rate: tx.exchange_rate, // Exact rate for this specific transaction!
            description: `إيرادات تذاكر الحديقة - إيصال ${tx.tx_number} - Rate (المعامل): ${tx.exchange_rate}${fullNotes ? ` [${fullNotes}]` : ""}`,
          },
        ],
        undefined,
        tx.currency,
        tx.transaction_date || now.toISOString().split("T")[0],
      );

      const saleRef = saleJE.reference || saleJE.id;
      tx.journal_entry_ref = saleRef;
      generatedJournalRefs.push(saleRef);

      // Handle refund accounting entry if transaction was refunded during this shift
      if (
        tx.status === "refunded" &&
        (!tx.refund_journal_ref || tx.refund_journal_ref.includes("معلقة"))
      ) {
        const refundDesc = `قيد إرجاع/استرداد تذاكر الحديقة - للمعاملة الأصلية (${tx.tx_number}) - وردية (${activeShift.shift_number}) - سبب الإرجاع: (${tx.refund_reason || "إلغاء وتجميع"}) - طريقة الدفع: ${methodArMap[tx.payment_method] || tx.payment_method} - العملة: ${tx.currency} - Rate (المعامل): ${tx.exchange_rate}`;
        const refundJE = this.addJournalEntry(
          refundDesc,
          [
            {
              account_code: "401000",
              debit: tx.total_paid_in_currency,
              credit: 0,
              currency: tx.currency,
              rate: tx.exchange_rate,
              description: `إرجاع إيراد تذاكر - إيصال ${tx.tx_number} - Rate (المعامل): ${tx.exchange_rate}`,
            },
            {
              account_code: debitAccountCode,
              debit: 0,
              credit: tx.total_paid_in_currency,
              currency: tx.currency,
              rate: tx.exchange_rate,
              description: `استرداد للمشتري (${methodArMap[tx.payment_method] || tx.payment_method}) - إيصال ${tx.tx_number} - Rate (المعامل): ${tx.exchange_rate}`,
            },
          ],
          undefined,
          tx.currency,
          tx.transaction_date || now.toISOString().split("T")[0],
        );

        const refundRef = refundJE.reference || refundJE.id;
        tx.refund_journal_ref = refundRef;
        generatedJournalRefs.push(refundRef);
      }
    });

    // Requirement 4 & 5: Transfer balances from operational treasuries to linked real treasuries & create transfer entries
    opTreasuries.forEach((opTr) => {
      const amt = opTr.balance || 0;
      opBalancesAtClose[opTr.id] = amt;

      if (amt > 0) {
        const realTr =
          (this.state.treasuries || []).find((t) => t.id === opTr.linked_real_treasury_id) ||
          this.state.treasuries[0];
        const realTrName = realTr ? realTr.name_ar : "الخزينة الرئيسية";
        const realAccountCode = realTr ? realTr.account_code || "101000" : "101000";

        let opAccountCode = "101000";
        if (opTr.payment_method === "visa") opAccountCode = "102000";
        else if (opTr.payment_method === "bank_transfer") opAccountCode = "103000";
        else if (opTr.payment_method === "credit") opAccountCode = "120100";

        const rate = opTr.currency === "SSP" ? this.getExchangeRate("SSP") : 1;
        const transferDesc = `ترحيل إغلاق وردية تذاكر الحديقة (${activeShift.shift_number}) - من الخزينة التشغيلية المؤقتة (${opTr.name_ar}) إلى الخزينة الرئيسية المرتبطة (${realTrName}) - المبلغ: ${amt} ${opTr.currency} - Rate (المعامل): ${rate}`;

        const transferJE = this.addJournalEntry(
          transferDesc,
          [
            {
              account_code: realAccountCode,
              debit: amt,
              credit: 0,
              currency: opTr.currency,
              rate: rate,
              description: `إيداع حديقة - وردية ${activeShift.shift_number} - من (${opTr.name_ar}) إلى الخزينة المرتبطة (${realTrName})`,
            },
            {
              account_code: opAccountCode,
              debit: 0,
              credit: amt,
              currency: opTr.currency,
              rate: rate,
              description: `إقفال رصيد الخزينة التشغيلية المؤقتة (${opTr.name_ar})`,
            },
          ],
          undefined,
          opTr.currency,
          now.toISOString().split("T")[0],
        );

        const jRef = transferJE.reference || transferJE.id;
        generatedJournalRefs.push(jRef);

        if (realTr) {
          realTr.balance = (realTr.balance || 0) + (opTr.currency === "USD" ? amt : amt / rate);
        }

        destinationTransfers.push({
          op_treasury_id: opTr.id,
          op_treasury_name: opTr.name_ar,
          real_treasury_id: opTr.linked_real_treasury_id,
          real_treasury_name: realTrName,
          currency: opTr.currency,
          amount: amt,
          journal_ref: jRef,
        });

        opTr.balance = 0;
      }
    });

    activeShift.status = "closed";
    activeShift.end_at = now.toISOString();
    activeShift.operational_treasury_balances_at_close = opBalancesAtClose;
    activeShift.destination_transfers = destinationTransfers;
    activeShift.generated_journal_refs = generatedJournalRefs;

    this.state.parkActiveShift = null;

    this.saveState();

    shiftAuditService.logShiftAction({
      shift_id: activeShift.id,
      shift_type: "park",
      shift_number: activeShift.shift_number,
      auto_shift_number: activeShift.auto_shift_number,
      action: "CLOSE",
      status_before: "open",
      status_after: "closed",
      cashier_name: activeShift.cashier_name,
      performed_by: this.state.currentUser || activeShift.cashier_name,
      details: `تم إغلاق وردية التذاكر (${activeShift.shift_number}) وتوليد ${generatedJournalRefs.length} قيود محاسبية تلقائية`,
      metadata: {
        end_at: activeShift.end_at,
        transactions_count: shiftTransactions.length,
        generated_journal_refs: generatedJournalRefs,
        destination_transfers: destinationTransfers,
        operational_balances: opBalancesAtClose,
      },
    });

    this.notify();
    this.logAction(
      "POS",
      "إغلاق وردية تذاكر",
      `تم إغلاق الوردية (${activeShift.shift_number}) وتوليد ${generatedJournalRefs.length} قيود محاسبية تلقائية بنجاح`,
      "UPDATE",
    );
    return activeShift;
  }

  // ==========================================
  // RESTAURANT SHIFT & REFUND MANAGEMENT
  // ==========================================

  generateUniqueRestaurantShiftNumber(): string {
    const todayStr = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const shifts = this.state.restaurantShifts || [];
    let count =
      shifts.filter((s) => s.auto_shift_number?.includes(todayStr) || s.id?.includes(todayStr))
        .length + 1;
    let candidate = `RST-${todayStr}-${count.toString().padStart(3, "0")}`;
    while (shifts.some((s) => s.auto_shift_number === candidate || s.id === candidate)) {
      count++;
      candidate = `RST-${todayStr}-${count.toString().padStart(3, "0")}`;
    }
    return candidate;
  }

  getRestaurantShifts(): RestaurantShift[] {
    return this.state.restaurantShifts || [];
  }

  getActiveRestaurantShift(): RestaurantShift | null {
    if (this.state.restaurantActiveShift && this.state.restaurantActiveShift.status === "open") {
      return this.state.restaurantActiveShift;
    }
    return null;
  }

  setActiveRestaurantShift(shiftId: string): RestaurantShift {
    const shift = (this.state.restaurantShifts || []).find((s) => s.id === shiftId);
    if (!shift) throw new Error("وردية المطعم غير موجودة!");
    this.state.restaurantActiveShift = shift;
    this.saveState();
    shiftAuditService.logShiftAction({
      shift_id: shift.id,
      shift_type: "restaurant",
      shift_number: shift.shift_number,
      auto_shift_number: shift.auto_shift_number,
      action: "ACTIVATE",
      status_before: shift.status,
      status_after: shift.status,
      cashier_name: shift.cashier_name,
      cashier_id: shift.cashier_id,
      performed_by: this.state.currentUser || shift.cashier_name,
      details: `تم تعيين وردية المطعم كنشطة للجلسة: ${shift.shift_number}`,
    });
    this.notify();
    return shift;
  }

  startNewRestaurantShift(payload: {
    shift_number?: string;
    auto_shift_number?: string;
    cashier_name: string;
    cashier_id?: string;
    cashier_type?: "hr" | "manual";
    opening_balance?: number;
    opening_notes?: string;
    notes?: string;
  }): RestaurantShift {
    const autoNum = payload.auto_shift_number || this.generateUniqueRestaurantShiftNumber();
    const finalShiftNum =
      payload.shift_number && payload.shift_number.trim()
        ? payload.shift_number.trim()
        : `وردية مطعم #${(this.state.restaurantShifts?.length || 0) + 1} - ${new Date().toLocaleDateString("ar-EG")}`;

    const newShift: RestaurantShift = {
      id: "shift-rest-" + Date.now(),
      auto_shift_number: autoNum,
      shift_number: finalShiftNum,
      start_at: new Date().toISOString(),
      status: "open",
      cashier_name: payload.cashier_name || "كاشير المطعم",
      cashier_id: payload.cashier_id,
      cashier_type: payload.cashier_type || "hr",
      opening_balance: Number(payload.opening_balance || 0),
      opening_notes: payload.opening_notes,
      notes: payload.notes,
      generated_journal_refs: [],
      orders_count: 0,
      total_sales: 0,
      total_tax: 0,
      total_discount: 0,
      total_service_fee: 0,
      total_delivery_fee: 0,
      total_refunds: 0,
      net_total: 0,
      payment_breakdown: { cash: 0, card: 0, wallet: 0 },
    };

    this.state.restaurantActiveShift = newShift;
    this.state.restaurantShifts = [newShift, ...(this.state.restaurantShifts || [])];
    this.saveState();

    shiftAuditService.logShiftAction({
      shift_id: newShift.id,
      shift_type: "restaurant",
      shift_number: newShift.shift_number,
      auto_shift_number: newShift.auto_shift_number,
      action: "OPEN",
      status_before: null,
      status_after: "open",
      cashier_name: newShift.cashier_name,
      cashier_id: newShift.cashier_id,
      performed_by: this.state.currentUser || newShift.cashier_name,
      details: `تم افتتاح وردية مطعم جديدة (${finalShiftNum} - رقم تلقائي: ${autoNum}) باسم: ${newShift.cashier_name}`,
      metadata: {
        start_at: newShift.start_at,
        opening_balance: newShift.opening_balance,
        opening_notes: newShift.opening_notes,
        cashier_type: newShift.cashier_type,
      },
    });

    this.logAction(
      "POS",
      "افتتاح وردية مطعم",
      `تم فتح وردية مطعم جديدة (${finalShiftNum} - رقم تلقائي: ${autoNum}) باسم: ${newShift.cashier_name}`,
      "CREATE",
    );
    this.notify();
    return newShift;
  }

  updateRestaurantShift(shiftId: string, updates: Partial<RestaurantShift>): RestaurantShift {
    const shifts = this.state.restaurantShifts || [];
    const shift = shifts.find((s) => s.id === shiftId);
    if (!shift) throw new Error("الوردية غير موجودة!");

    Object.assign(shift, updates);

    if (this.state.restaurantActiveShift && this.state.restaurantActiveShift.id === shiftId) {
      Object.assign(this.state.restaurantActiveShift, updates);
    }

    this.saveState();

    shiftAuditService.logShiftAction({
      shift_id: shift.id,
      shift_type: "restaurant",
      shift_number: shift.shift_number,
      auto_shift_number: shift.auto_shift_number,
      action: "UPDATE",
      status_before: shift.status,
      status_after: shift.status,
      cashier_name: shift.cashier_name,
      cashier_id: shift.cashier_id,
      performed_by: this.state.currentUser || shift.cashier_name,
      details: `تم تعديل بيانات وردية المطعم (${shift.shift_number})`,
      metadata: updates,
    });

    this.logAction(
      "POS",
      "تعديل بيانات وردية مطعم",
      `تم تعديل بيانات الوردية (${shift.shift_number})`,
      "UPDATE",
    );
    this.notify();
    return shift;
  }

  deleteRestaurantShift(shiftId: string): boolean {
    const shifts = this.state.restaurantShifts || [];
    const shiftIdx = shifts.findIndex((s) => s.id === shiftId);
    if (shiftIdx === -1) throw new Error("الوردية غير موجودة!");
    const shift = shifts[shiftIdx];

    shifts.splice(shiftIdx, 1);
    this.state.restaurantShifts = shifts;

    if (this.state.restaurantActiveShift?.id === shiftId) {
      this.state.restaurantActiveShift = null;
    }

    this.saveState();

    shiftAuditService.logShiftAction({
      shift_id: shiftId,
      shift_type: "restaurant",
      shift_number: shift.shift_number,
      auto_shift_number: shift.auto_shift_number || null,
      action: "DELETE",
      status_before: shift.status,
      status_after: "deleted",
      cashier_name: shift.cashier_name,
      cashier_id: shift.cashier_id,
      performed_by: this.state.currentUser || "مسؤول النظام",
      details: `تم حذف وردية المطعم (${shift.shift_number}) من النظام بالكامل`,
    });

    this.logAction(
      "POS",
      "حذف وردية مطعم",
      `تم حذف وردية المطعم (${shift.shift_number}) من النظام`,
      "DELETE",
    );
    this.notify();
    return true;
  }

  getOrCreateActiveRestaurantShift(cashierName = "كاشير المطعم"): RestaurantShift {
    let active = this.state.restaurantActiveShift;
    if (!active || active.status !== "open") {
      const autoNum = this.generateUniqueRestaurantShiftNumber();
      active = {
        id: "shift-rest-" + Date.now(),
        auto_shift_number: autoNum,
        shift_number: `وردية مطعم #${(this.state.restaurantShifts?.length || 0) + 1} - ${new Date().toLocaleDateString("ar-EG")}`,
        start_at: new Date().toISOString(),
        status: "open",
        cashier_name: cashierName,
        generated_journal_refs: [],
        orders_count: 0,
        total_sales: 0,
        total_tax: 0,
        total_discount: 0,
        total_service_fee: 0,
        total_delivery_fee: 0,
        total_refunds: 0,
        net_total: 0,
        payment_breakdown: { cash: 0, card: 0, wallet: 0 },
      };
      this.state.restaurantActiveShift = active;
      this.state.restaurantShifts = [active, ...(this.state.restaurantShifts || [])];
      this.saveState();

      shiftAuditService.logShiftAction({
        shift_id: active.id,
        shift_type: "restaurant",
        shift_number: active.shift_number,
        auto_shift_number: active.auto_shift_number,
        action: "AUTO_CREATE",
        status_before: null,
        status_after: "open",
        cashier_name: cashierName,
        performed_by: this.state.currentUser || cashierName,
        details: `تم إنشاء وردية مطعم تلقائية للجلسة (${active.shift_number})`,
        metadata: {
          start_at: active.start_at,
          auto_created: true,
        },
      });

      this.notify();
    }
    return active;
  }

  closeRestaurantShift(shiftId?: string, closingNotes?: string): RestaurantShift {
    const activeShift = shiftId
      ? (this.state.restaurantShifts || []).find((s) => s.id === shiftId)
      : this.state.restaurantActiveShift;

    if (!activeShift || activeShift.status !== "open") {
      throw new Error("لا توجد وردية مطعم مفتوحة لإغلاقها!");
    }

    const now = new Date();
    activeShift.status = "closed";
    activeShift.end_at = now.toISOString();
    if (closingNotes) activeShift.closing_notes = closingNotes;

    // Compile refunds for this shift
    const shiftRefunds = (this.state.restaurantRefundRecords || []).filter(
      (r) => r.shift_id === activeShift.id || r.shift_number === activeShift.shift_number,
    );
    const totalRefundAmt = shiftRefunds.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0);
    activeShift.total_refunds = totalRefundAmt;
    activeShift.refunds_count = shiftRefunds.length;
    activeShift.net_total = Math.max(0, Number(activeShift.total_sales || 0) - totalRefundAmt);

    // Requirement 2: Do NOT open a new shift automatically upon closing
    if (this.state.restaurantActiveShift?.id === activeShift.id) {
      this.state.restaurantActiveShift = null;
    }

    this.saveState();

    shiftAuditService.logShiftAction({
      shift_id: activeShift.id,
      shift_type: "restaurant",
      shift_number: activeShift.shift_number,
      auto_shift_number: activeShift.auto_shift_number,
      action: "CLOSE",
      status_before: "open",
      status_after: "closed",
      cashier_name: activeShift.cashier_name,
      cashier_id: activeShift.cashier_id,
      performed_by: this.state.currentUser || activeShift.cashier_name,
      details: `تم إغلاق وردية المطعم (${activeShift.shift_number}) وتحديث التقارير المحاسبية`,
      metadata: {
        end_at: activeShift.end_at,
        closing_notes: closingNotes,
        orders_count: activeShift.orders_count,
        total_sales: activeShift.total_sales,
        total_refunds: activeShift.total_refunds,
        net_total: activeShift.net_total,
        payment_breakdown: activeShift.payment_breakdown,
      },
    });

    this.notify();
    this.logAction(
      "POS",
      "إغلاق وردية مطعم",
      `تم إغلاق وردية المطعم (${activeShift.shift_number}) وتحديث التقارير المحاسبية`,
      "UPDATE",
    );
    return activeShift;
  }

  /**
   * Diagnostic and recovery tool: allows recovering or updating any shift state
   */
  recoverShiftState(shiftId: string, targetStatus: "open" | "closed", makeActive?: boolean): boolean {
    const isPark = shiftId.startsWith("shift-park-") || (this.state.parkShifts || []).some((s) => s.id === shiftId);
    if (isPark) {
      const shift = (this.state.parkShifts || []).find((s) => s.id === shiftId);
      if (!shift) throw new Error("وردية التذاكر غير موجودة!");
      const prevStatus = shift.status;
      shift.status = targetStatus;
      if (targetStatus === "open") {
        shift.end_at = undefined;
        if (makeActive) {
          this.state.parkActiveShift = shift;
        }
      } else {
        shift.end_at = shift.end_at || new Date().toISOString();
        if (this.state.parkActiveShift?.id === shiftId) {
          this.state.parkActiveShift = null;
        }
      }
      this.saveState();
      this.saveToIDB(this.state);
      shiftAuditService.logShiftAction({
        shift_id: shift.id,
        shift_type: "park",
        shift_number: shift.shift_number,
        auto_shift_number: shift.auto_shift_number,
        action: "RECOVER_STATE",
        status_before: prevStatus,
        status_after: targetStatus,
        details: `إصلاح حالة الوردية يدوياً بواسطة المطور/المسؤول من "${prevStatus}" إلى "${targetStatus}"`,
        performed_by: this.state.currentUser || "مسؤول النظام",
      });
      this.notify();
      return true;
    } else {
      const shift = (this.state.restaurantShifts || []).find((s) => s.id === shiftId);
      if (!shift) throw new Error("وردية المطعم غير موجودة!");
      const prevStatus = shift.status;
      shift.status = targetStatus;
      if (targetStatus === "open") {
        shift.end_at = undefined;
        if (makeActive) {
          this.state.restaurantActiveShift = shift;
        }
      } else {
        shift.end_at = shift.end_at || new Date().toISOString();
        if (this.state.restaurantActiveShift?.id === shiftId) {
          this.state.restaurantActiveShift = null;
        }
      }
      this.saveState();
      shiftAuditService.logShiftAction({
        shift_id: shift.id,
        shift_type: "restaurant",
        shift_number: shift.shift_number,
        auto_shift_number: shift.auto_shift_number,
        action: "RECOVER_STATE",
        status_before: prevStatus,
        status_after: targetStatus,
        details: `إصلاح حالة وردية المطعم يدوياً من "${prevStatus}" إلى "${targetStatus}"`,
        performed_by: this.state.currentUser || "مسؤول النظام",
      });
      this.notify();
      return true;
    }
  }

  getRestaurantRefundRecords(shiftId?: string): RestaurantRefundRecord[] {
    const all = this.state.restaurantRefundRecords || [];
    if (!shiftId) return all;
    return all.filter((r) => r.shift_id === shiftId);
  }

  refundRestaurantOrder(payload: {
    order_number: number;
    refund_amount: number;
    refund_reason: string;
    payment_method?: "cash" | "card" | "wallet";
    currency?: string;
    treasury_id?: string;
    cashier_name?: string;
    items_summary?: string;
  }): RestaurantRefundRecord {
    const currentShift = this.getActiveRestaurantShift() || this.getOrCreateActiveRestaurantShift();
    const currency = payload.currency || "EGP";
    const paymentMethod = payload.payment_method || "cash";
    const refundAmt = Number(payload.refund_amount);
    const cashierName = payload.cashier_name || currentShift.cashier_name || "كاشير المطعم";
    const journalRef = `REF-${payload.order_number}`;

    const refundRecord: RestaurantRefundRecord = {
      id: "ref-" + Date.now(),
      order_number: payload.order_number,
      shift_id: currentShift.id,
      shift_number: currentShift.shift_number,
      refund_amount: refundAmt,
      refund_reason: payload.refund_reason || "استرداد قيمة الطلب",
      created_at: new Date().toISOString(),
      journal_ref: journalRef,
      cashier_name: cashierName,
      payment_method: paymentMethod,
      currency: currency,
      items_summary: payload.items_summary,
    };

    if (!this.state.restaurantRefundRecords) {
      this.state.restaurantRefundRecords = [];
    }
    this.state.restaurantRefundRecords.unshift(refundRecord);

    // Double entry accounting for refund:
    // Debit: Sales Returns (401000 or 402000)
    // Credit: Cashier / Bank Treasury Account (101000 or 102000 or 103000)
    let treasuryAccount = "101000";
    if (paymentMethod === "card") treasuryAccount = "102000";
    else if (paymentMethod === "wallet") treasuryAccount = "103000";

    const rate = this.getExchangeRate(currency);
    const journalLines = [
      {
        account_code: "401000", // Sales / Sales Returns
        debit: refundAmt,
        credit: 0,
        currency: currency,
        rate: rate,
      },
      {
        account_code: treasuryAccount,
        debit: 0,
        credit: refundAmt,
        currency: currency,
        rate: rate,
      },
    ];

    this.addJournalEntry(
      `قيد مردودات ومسترجعات مبيعات المطعم - طلب #${payload.order_number} - وردية (${currentShift.shift_number}) - سبب الإرجاع: (${payload.refund_reason})`,
      journalLines,
      journalRef,
      currency,
    );

    if (currentShift.generated_journal_refs) {
      currentShift.generated_journal_refs.push(journalRef);
    } else {
      currentShift.generated_journal_refs = [journalRef];
    }

    // Deduct from treasury transactions
    const targetTreasuryId =
      payload.treasury_id ||
      this.state.treasuries.find((t) => t.linked_to_restaurant && !t.deleted)?.id ||
      "tr-1";

    try {
      this.addTreasuryTransaction(
        targetTreasuryId,
        "refund",
        refundAmt,
        currency,
        `مرتجع مبيعات المطعم - طلب رقم #${payload.order_number} - سبب: ${payload.refund_reason}`,
        journalRef,
        paymentMethod,
      );
    } catch (err) {
      console.error("Error adding treasury transaction for refund:", err);
    }

    // Update shift refund totals
    currentShift.total_refunds = (currentShift.total_refunds || 0) + refundAmt;
    currentShift.refunds_count = (currentShift.refunds_count || 0) + 1;
    currentShift.net_total = Math.max(
      0,
      (currentShift.total_sales || 0) - currentShift.total_refunds,
    );

    this.saveState();
    this.notify();
    this.logAction(
      "POS",
      "تسجيل حركة مرتجع",
      `تم تسجيل حركة مرتجع بقيمة ${refundAmt} ${currency} للطلب #${payload.order_number} وردية (${currentShift.shift_number})`,
      "CREATE",
    );

    return refundRecord;
  }
}
export const erpStore = new ERPStore();
