import { ORACLE_MIGRATION_ACCOUNTS } from "../data/oracleAccounts";
import type {
  Account,
  Branch,
  Employee,
  JournalEntry,
  MallGardenExpense,
  MallGardenRevenue,
  MallRentalPayment,
  MallShop,
  ParkCustomer,
  ParkOperationalTreasury,
  ParkTicketItem,
  Supplier,
  SystemUser,
  TreasuryAccount,
  TreasuryTransaction,
  UserPermission,
} from "./erpTypes";

export const DEFAULT_EMPLOYEES: Employee[] = [
  {
    id: "emp-1",
    employee_code: "1001",
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
    employee_code: "1002",
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
    employee_code: "1003",
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
    employee_code: "1004",
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
    employee_code: "1005",
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

export function ensureEmployeesWithUniqueCodes(rawEmployees: unknown): Employee[] {
  const list = Array.isArray(rawEmployees) && rawEmployees.length > 0
    ? (rawEmployees as Employee[])
    : DEFAULT_EMPLOYEES;

  const usedCodes = new Set<string>();
  let maxNumericCode = 1000;

  // First pass: collect valid existing numeric codes
  list.forEach((emp) => {
    const rawCode = String((emp as any)?.employee_code || "").trim();
    if (/^\d{3,6}$/.test(rawCode) && !usedCodes.has(rawCode)) {
      usedCodes.add(rawCode);
      const num = parseInt(rawCode, 10);
      if (!Number.isNaN(num) && num > maxNumericCode) {
        maxNumericCode = num;
      }
    }
  });

  // Second pass: ensure every employee has a clean, easy, unique employee_code
  const seenAssign = new Set<string>();
  return list.map((emp, idx) => {
    const defaultMatch = DEFAULT_EMPLOYEES.find((d) => d.id === emp.id);
    let candidate = String((emp as any)?.employee_code || defaultMatch?.employee_code || "").trim();

    if (!candidate || !/^\d{3,6}$/.test(candidate) || seenAssign.has(candidate)) {
      let nextNum = Math.max(1001 + idx, maxNumericCode + 1);
      while (seenAssign.has(String(nextNum)) || usedCodes.has(String(nextNum))) {
        nextNum++;
      }
      candidate = String(nextNum);
      maxNumericCode = Math.max(maxNumericCode, nextNum);
    }

    seenAssign.add(candidate);
    usedCodes.add(candidate);

    return {
      ...emp,
      employee_code: candidate,
    };
  });
}

export function generateNextUniqueEmployeeCode(
  employees: Employee[] = [],
  users: SystemUser[] = [],
): string {
  const used = new Set<string>();
  let maxCode = 1000;

  [...(employees || []), ...(users || [])].forEach((item: any) => {
    const code = String(item?.employee_code || "").trim();
    if (code) {
      used.add(code);
      const parsed = parseInt(code, 10);
      if (!Number.isNaN(parsed) && parsed >= 1000 && parsed < 999999 && parsed > maxCode) {
        maxCode = parsed;
      }
    }
  });

  let next = maxCode + 1;
  while (used.has(String(next))) {
    next++;
  }
  return String(next);
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

export const DEFAULT_GARDEN_REVENUES: MallGardenRevenue[] = [];

export const DEFAULT_GARDEN_EXPENSES: MallGardenExpense[] = [];

export const DEFAULT_MALL_SHOPS: MallShop[] = [
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

export const DEFAULT_MALL_PAYMENTS: MallRentalPayment[] = [];

export const DEFAULT_BRANCHES: Branch[] = [
  { id: "branch-1", name: "Main Branch", name_ar: "الفرع الرئيسي", code: "MAIN" },
];

export const DEFAULT_COST_CENTERS = [
  "المطبخ (Kitchen)",
  "البار (Bar)",
  "التوصيل (Delivery)",
  "الإدارة (Administration)",
  "التسويق (Marketing)",
  "المستودع (Warehouse)",
];

export const USD_SEED_TRANSACTIONS: TreasuryTransaction[] = [];
export const EGP_SEED_TRANSACTIONS: TreasuryTransaction[] = [];
export const DEFAULT_EXPIRY_SEED: any[] = [];
export const DEFAULT_ACCOUNTS: Account[] = ORACLE_MIGRATION_ACCOUNTS as any;
export const SEED_AH_JOURNAL_ENTRIES: JournalEntry[] = [];

export const DEFAULT_TREASURIES: TreasuryAccount[] = [
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

export const DEFAULT_SUPPLIERS: Supplier[] = ORACLE_MIGRATION_ACCOUNTS.filter(
  (a) => a.parent_code === "24010" || (a.code.startsWith("24010") && a.level === 4),
).map((a) => ({
  id: `sup-${a.code}`,
  name_ar: a.name_ar,
  phone: "",
  balance: 0,
  account_code: a.code,
  currency: ("currency" in a && a.currency ? a.currency : "USD") as "USD" | "SYP" | "TRY",
  deleted: false,
}));

export const LEGACY_DEFAULT_USER_IDS = new Set(["u-manager", "u-cashier"]);

export const DEFAULT_COMPLIANT_ADMIN_PASSWORD = "Admin@12345";

export const ROOT_DEFAULT_ADMIN: SystemUser = {
  id: "u-admin",
  employee_code: "1000",
  full_name: "المدير العام (System Admin)",
  username: "admin",
  email: "admin@restocash.com",
  phone: "01000000000",
  role: "super_admin",
  password: DEFAULT_COMPLIANT_ADMIN_PASSWORD,
  permissions: {
    super_admin_full_access: true,
    orders: true,
    pos: true,
    captain: true,
    kitchen: true,
    delivery: true,
    inventory: true,
    hr: true,
    hr_view_attendance: true,
    hr_manage_payroll_loans: true,
    messenger_broadcast: true,
    purchasing: true,
    production: true,
    treasury: true,
    accounting: true,
    journal_approval: true,
    expense_approval: true,
    revenue_approval: true,
    reports: true,
    cost_centers: true,
    mall_manage_shops: true,
    mall_garden_finance: true,
    manage_park_shifts: true,
    delete_park_shifts: true,
    park_reports: true,
    park_open_shift: true,
    park_returns: true,
    restaurant_open_shift: true,
    restaurant_returns: true,
    branch_mgmt: true,
    audit_logs: true,
    users_roles: true,
    system_manage_users: true,
    system_backup_update: true,
    developer_options: true,
  },
  created_at: "2026-01-01T00:00:00.000Z",
};

export const OWNER_DEFAULT_ADMIN: SystemUser = {
  id: "u-owner-mahmoud",
  employee_code: "1000",
  full_name: "المدير العام (mahmoudhindam9)",
  username: "mahmoud.admin",
  email: "mahmoudhindam9@gmail.com",
  phone: "01000000000",
  role: "super_admin",
  password: DEFAULT_COMPLIANT_ADMIN_PASSWORD,
  permissions: {
    ...ROOT_DEFAULT_ADMIN.permissions,
  },
  created_at: "2026-01-01T00:00:00.000Z",
};

function sanitizeCompliantUsername(rawUsername: string, fallbackIndex = 1): string {
  const lower = String(rawUsername || "")
    .trim()
    .toLowerCase();
  const basePart = lower.includes("@") ? lower.split("@")[0] : lower;
  let cleaned = basePart
    .replace(/[^a-z0-9._-]/g, ".")
    .replace(/\.{2,}/g, ".")
    .replace(/^[._-]+|[._-]+$/g, "");
  if (cleaned.length < 3) {
    cleaned = `user.${cleaned || fallbackIndex}`;
  }
  return cleaned.slice(0, 32);
}

function isCompliantPasswordValue(pw: unknown): boolean {
  if (typeof pw !== "string" || pw.length < 8) return false;
  if (/\s/.test(pw)) return false;
  return /[A-Za-z]/.test(pw) && /[0-9]/.test(pw);
}

export function ensureCurrentManagedUsers(
  users: unknown,
  employees: Employee[] = DEFAULT_EMPLOYEES,
): SystemUser[] {
  const rawList = Array.isArray(users)
    ? (users.filter(
        (user: any) =>
          user &&
          !LEGACY_DEFAULT_USER_IDS.has(String(user.id || "")) &&
          typeof user.username === "string" &&
          user.username.trim().length > 0,
      ) as SystemUser[])
    : [];

  const usedUsernames = new Set<string>();
  const usedEmails = new Set<string>();
  const usedCodes = new Set<string>();

  const normalizedEmployees = ensureEmployeesWithUniqueCodes(employees);

  const normalizedList: SystemUser[] = rawList.map((user, idx) => {
    const rawUserStr = String(user.username || "").trim().toLowerCase();
    const rawEmailStr = String(user.email || "").trim().toLowerCase();

    const candidateEmail =
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rawEmailStr)
        ? rawEmailStr
        : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(rawUserStr)
          ? rawUserStr
          : "";

    let compliantUsername =
      rawUserStr === "mahmoudhindam9@gmail.com"
        ? "mahmoud.admin"
        : rawUserStr === "admin@restocash.local" || rawUserStr === "admin@restocash.com"
          ? "admin"
          : sanitizeCompliantUsername(rawUserStr, idx + 1);

    if (usedUsernames.has(compliantUsername)) {
      compliantUsername = `${compliantUsername.slice(0, 28)}.${idx + 1}`;
    }
    usedUsernames.add(compliantUsername);

    let compliantEmail =
      candidateEmail ||
      (compliantUsername === "admin"
        ? "admin@restocash.com"
        : `${compliantUsername}@restocash.com`);

    if (usedEmails.has(compliantEmail)) {
      compliantEmail = `${compliantUsername}.${idx + 1}@restocash.com`;
    }
    usedEmails.add(compliantEmail);

    const resolvedPassword = isCompliantPasswordValue(user.password)
      ? String(user.password)
      : DEFAULT_COMPLIANT_ADMIN_PASSWORD;

    const validRoles = new Set([
      "super_admin",
      "admin",
      "manager",
      "cashier",
      "captain",
      "kitchen",
    ]);
    const rawRole = String(user.role || "cashier").trim().toLowerCase();
    const resolvedRole = (
      compliantUsername === "admin" && (rawRole === "admin" || rawRole === "super_admin")
        ? "super_admin"
        : validRoles.has(rawRole)
          ? rawRole
          : "cashier"
    ) as SystemUser["role"];

    const resolvedPermissions =
      compliantUsername === "admin"
        ? { ...ROOT_DEFAULT_ADMIN.permissions, ...(user.permissions || {}) }
        : { ...(user.permissions || {}) };

    const fullNameClean = String(user.full_name || compliantUsername).trim().slice(0, 120);

    // Match employee_code with HR employee if linked by code or name, otherwise assign unique code
    const matchedHrEmp = normalizedEmployees.find(
      (e) =>
        (user.employee_code && e.employee_code === String(user.employee_code).trim()) ||
        e.name.trim() === fullNameClean,
    );

    let resolvedEmployeeCode = String(
      matchedHrEmp?.employee_code ||
        user.employee_code ||
        (compliantUsername === "admin" ? "1000" : ""),
    ).trim();

    if (!resolvedEmployeeCode || usedCodes.has(resolvedEmployeeCode)) {
      let candidateNum = compliantUsername === "admin" ? 1000 : 1001 + idx;
      while (usedCodes.has(String(candidateNum))) {
        candidateNum++;
      }
      resolvedEmployeeCode = String(candidateNum);
    }
    usedCodes.add(resolvedEmployeeCode);

    return {
      ...user,
      employee_code: resolvedEmployeeCode,
      full_name: fullNameClean,
      username: compliantUsername,
      email: compliantEmail,
      phone: String(user.phone || matchedHrEmp?.phone || "").trim().slice(0, 40),
      role: resolvedRole,
      password: resolvedPassword,
      permissions: resolvedPermissions,
    };
  });

  const hasAdmin = normalizedList.some((u) => u.username === "admin");
  if (!hasAdmin) {
    normalizedList.unshift({
      ...ROOT_DEFAULT_ADMIN,
      employee_code: usedCodes.has("1000") ? "1000-A" : "1000",
      permissions: { ...ROOT_DEFAULT_ADMIN.permissions },
    });
  }

  return normalizedList;
}

export const DEFAULT_PERMISSIONS: Record<string, UserPermission> = {
  admin: {
    orders: true,
    pos: true,
    captain: true,
    kitchen: true,
    delivery: true,
    inventory: true,
    hr: true,
    messenger_broadcast: true,
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
    messenger_broadcast: true,
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
