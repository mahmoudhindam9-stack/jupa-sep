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

export type Treasury = TreasuryAccount;

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
  balance: number;
  account_code?: string;
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
  related_entity_id?: string;
  payment_method?: string;
  note: string;
  created_at: string;
}

export interface Voucher {
  id: string;
  branch_id: string;
  type: "receipt" | "payment" | "transfer";
  category: string;
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
  exchange_rate?: number;
  base_amount?: number;
  journal_entry_id?: string;
  journal_reference?: string;
  account_code?: string;
  custom_category?: string;
  custom_cost_center?: string;
  reverted?: boolean;
  reverted_at?: string;
  reverted_reason?: string;
  deleted_at?: string;
  deleted_by?: string;
  deleted_reason?: string;
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

export function isLevel4Account(account?: { level?: number; code: string } | null): boolean {
  if (!account) return false;
  if (Number(account.level) === 4) return true;
  if (!account.level && account.code && account.code.length >= 6) return true;
  return false;
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
  username: string;
  email?: string;
  phone: string;
  role: string;
  password?: string;
  permissions?: UserPermission;
  created_at: string;
}

export interface UserPermission {
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
  developer_options?: boolean;
  restaurant_open_shift?: boolean;
  restaurant_returns?: boolean;
  park_open_shift?: boolean;
  park_returns?: boolean;
  approval_journals?: boolean;
  approval_expenses?: boolean;
  approval_revenues?: boolean;
  orders_view?: boolean;
  orders_create_custom?: boolean;
  orders_cancel_modify?: boolean;
  orders_manage_carts?: boolean;
  orders_generate_qr?: boolean;
  pos_access?: boolean;
  pos_create_custom_order?: boolean;
  pos_apply_discounts?: boolean;
  pos_void_items?: boolean;
  captain_access?: boolean;
  captain_create_order?: boolean;
  captain_transfer_tables?: boolean;
  captain_modify_items?: boolean;
  kitchen_view?: boolean;
  kitchen_change_status?: boolean;
  kitchen_modify_order?: boolean;
  delivery_view?: boolean;
  delivery_update_status?: boolean;
  inventory_view?: boolean;
  inventory_adjust_transfer?: boolean;
  inventory_waste_dispose?: boolean;
  purchasing_view?: boolean;
  purchasing_add_invoice?: boolean;
  purchasing_returns?: boolean;
  production_view?: boolean;
  production_execute?: boolean;
  hr_view_attendance?: boolean;
  hr_manage_payroll_loans?: boolean;
  treasury_view?: boolean;
  treasury_open_close?: boolean;
  treasury_transfer_reconcile?: boolean;
  accounting_view?: boolean;
  accounting_post_journal?: boolean;
  accounting_lock_period?: boolean;
  mall_manage_shops?: boolean;
  mall_garden_finance?: boolean;
  reports_view_sales?: boolean;
  reports_view_financials?: boolean;
  super_admin_full_access?: boolean;
  system_manage_users?: boolean;
  system_backup_update?: boolean;
  system_audit_logs?: boolean;
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
