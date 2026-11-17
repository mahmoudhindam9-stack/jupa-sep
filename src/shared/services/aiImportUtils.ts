import * as XLSX from "xlsx";
import { InventoryItem } from "@/shared/types";
import { SystemUser } from "@/shared/services/erpStore";
import { normalizeManagedUsername } from "@/features/auth/services/managedUserValidation";

export type DishImagePreset =
  | "burger"
  | "grill"
  | "pizza"
  | "pasta"
  | "salad"
  | "drink"
  | "dessert"
  | "appetizer";

export const DISH_IMAGE_PRESETS: Record<
  DishImagePreset,
  { url: string; label: string }
> = {
  burger: { url: "/assets/dishes/burger.jpg", label: "برجر / سندويتش" },
  grill: { url: "/assets/dishes/grill.jpg", label: "مشويات" },
  pizza: { url: "/assets/dishes/pizza.jpg", label: "بيتزا" },
  pasta: { url: "/assets/dishes/pasta.jpg", label: "باستا / أطباق" },
  salad: { url: "/assets/dishes/salad.jpg", label: "سلطات" },
  drink: { url: "/assets/dishes/drink.jpg", label: "مشروبات" },
  dessert: { url: "/assets/dishes/dessert.jpg", label: "حلويات" },
  appetizer: { url: "/assets/dishes/appetizer.jpg", label: "مقبلات" },
};

export function resolveDishImageUrl(
  presetOrName?: string | null,
  categoryName?: string | null,
): string {
  const raw = String(presetOrName || "").trim().toLowerCase();
  if (raw in DISH_IMAGE_PRESETS) {
    return DISH_IMAGE_PRESETS[raw as DishImagePreset].url;
  }

  const combined = `${presetOrName || ""} ${categoryName || ""}`.toLowerCase();
  if (
    /برجر|سندويتش|شاورما|كريب|تورتيلا|burger|sandwich|wrap|shawarma|hotdog/.test(
      combined,
    )
  ) {
    return DISH_IMAGE_PRESETS.burger.url;
  }
  if (
    /مشوي|كباب|كفتة|فحم|شيش|تكا|ستيك|فراخ|دجاج|لحم|مندي|grill|kebab|steak|chicken|meat/.test(
      combined,
    )
  ) {
    return DISH_IMAGE_PRESETS.grill.url;
  }
  if (/بيتزا|فطير|مناقيش|pizza|calzone/.test(combined)) {
    return DISH_IMAGE_PRESETS.pizza.url;
  }
  if (
    /مكرون|باستا|لازانيا|سباجيتي|أرز|رز|برياني|كبسة|طاجن|pasta|risotto|rice|noodle/.test(
      combined,
    )
  ) {
    return DISH_IMAGE_PRESETS.pasta.url;
  }
  if (/سلط|فتوش|تبول|سيزر|خضار|salad|coleslaw/.test(combined)) {
    return DISH_IMAGE_PRESETS.salad.url;
  }
  if (
    /عصير|بيبسي|كولا|مشروب|قهوة|اسبريسو|لاتيه|كابتشينو|شاي|ماء|مياه|موخيتو|سموذي|ميلك|drink|juice|soda|coffee|tea|water|cola|pepsi/.test(
      combined,
    )
  ) {
    return DISH_IMAGE_PRESETS.drink.url;
  }
  if (
    /حلو|كنافة|بسبوسة|بقلاوة|أم علي|تشيز|كيك|تورتة|آيس|دونات|وافل|كريب حلو|dessert|cake|sweet|ice cream/.test(
      combined,
    )
  ) {
    return DISH_IMAGE_PRESETS.dessert.url;
  }

  return DISH_IMAGE_PRESETS.appetizer.url;
}

export function normalizeArabicText(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/(^|\s)ال/g, "$1")
    .replace(/\s+/g, " ");
}

export function normalizeUnit(unit?: string | null): string {
  const u = String(unit || "").trim().toLowerCase();
  if (!u) return "pcs";
  if (/(كيلو|كجم|كغ|\bkg\b|kilogram)/.test(u)) return "كجم";
  if (/(جرام|جم|غرام|\bg\b|gram)/.test(u)) return "جم";
  if (/(لتر|\bl\b|liter|litre)/.test(u)) return "لتر";
  if (/(مل|ملل|\bml\b)/.test(u)) return "مل";
  if (/(علب|باكت|كرتون|زجاج|عبو|box|pack|bottle|can)/.test(u)) return "علبة";
  if (/(حبة|قطعة|عدد|طبق|وجبة|رغيف|pcs|pc|piece|unit|وحدة)/.test(u)) return "pcs";
  return unit!.trim();
}

export function matchInventoryItemByName(
  name: string,
  inventory: InventoryItem[],
): InventoryItem | undefined {
  const target = normalizeArabicText(name);
  if (!target) return undefined;

  const exact = inventory.find((item) => normalizeArabicText(item.name_ar) === target);
  if (exact) return exact;

  return inventory.find((item) => {
    const invNorm = normalizeArabicText(item.name_ar);
    return (
      invNorm.length >= 2 &&
      target.length >= 2 &&
      (invNorm.includes(target) || target.includes(invNorm))
    );
  });
}

export async function parseSpreadsheetFile(
  file: File,
): Promise<{ text: string; rows: Record<string, any>[] }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || name.endsWith(".txt")) {
    const rawText = await file.text();
    const workbook = XLSX.read(rawText, { type: "string" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = firstSheet
      ? XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, { defval: "" })
      : [];
    return {
      text: rawText.slice(0, 60_000),
      rows,
    };
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const allRows: Record<string, any>[] = [];
  const textParts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
    if (rows.length > 0) {
      allRows.push(...rows);
      textParts.push(`[${sheetName}]\n${XLSX.utils.sheet_to_csv(sheet)}`);
    }
  }

  return {
    text: textParts.join("\n\n").slice(0, 60_000),
    rows: allRows,
  };
}

export async function fileToBase64Payload(
  file: File,
  maxDimension = 1600,
): Promise<{ base64: string; mimeType: string }> {
  if (file.type.startsWith("image/") && typeof document !== "undefined") {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("تعذر قراءة الصورة"));
        reader.readAsDataURL(file);
      });

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("تعذر تحميل الصورة"));
        image.src = dataUrl;
      });

      const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.85);
        const commaIdx = compressed.indexOf(",");
        if (commaIdx !== -1) {
          return {
            base64: compressed.slice(commaIdx + 1),
            mimeType: "image/jpeg",
          };
        }
      }
    } catch {
      // Fallback to raw reader below
    }
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return {
    base64: btoa(binary),
    mimeType: file.type || "application/octet-stream",
  };
}

export function isSpreadsheetFile(file: File): boolean {
  const n = file.name.toLowerCase();
  return n.endsWith(".xlsx") || n.endsWith(".xls") || n.endsWith(".csv") || n.endsWith(".txt");
}

const ARABIC_CHAR_MAP: Record<string, string> = {
  ا: "a",
  أ: "a",
  إ: "e",
  آ: "a",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "g",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "dh",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  ة: "a",
  و: "w",
  ي: "y",
  ى: "a",
  ئ: "e",
  ؤ: "o",
  ء: "a",
};

export function transliterateToUsernameBase(fullName: string): string {
  const clean = String(fullName || "").trim().toLowerCase();
  let out = "";
  for (const ch of clean) {
    if (/[a-z0-9]/.test(ch)) {
      out += ch;
    } else if (ch === " " || ch === "." || ch === "-" || ch === "_") {
      out += ".";
    } else if (ARABIC_CHAR_MAP[ch]) {
      out += ARABIC_CHAR_MAP[ch];
    }
  }
  const normalized = normalizeManagedUsername(out).replace(/\.{2,}/g, ".").replace(/^\.+|\.+$/g, "");
  return normalized.length >= 3 ? normalized.slice(0, 24) : "";
}

export function generateUniqueBatchUsername(
  preferredUsername: string | undefined,
  fullName: string,
  empCode: string,
  takenUsernames: Set<string>,
): string {
  const explicit = normalizeManagedUsername(preferredUsername || "");
  const transliterated = transliterateToUsernameBase(fullName);
  const codeDigits = String(empCode || "").replace(/[^0-9a-z]/gi, "").toLowerCase();

  let base =
    explicit.length >= 3
      ? explicit
      : transliterated.length >= 3
        ? transliterated
        : `staff.${codeDigits || "100"}`;

  let candidate = base;
  let suffix = 1;
  while (takenUsernames.has(candidate)) {
    const codePart = suffix === 1 && codeDigits ? codeDigits : String(suffix + 1);
    candidate = `${base.slice(0, 20)}.${codePart}`;
    suffix += 1;
  }
  takenUsernames.add(candidate);
  return candidate;
}

export interface BatchEmployeeDraftRow {
  tempId: string;
  name: string;
  job_title: string;
  department: string;
  salary: number;
  currency: "EGP" | "USD";
  phone: string;
  email: string;
  role: string;
  createUser: boolean;
  username: string;
}

export function buildBatchEmployeeDrafts(
  parsed: Array<{
    name: string;
    job_title?: string;
    department?: string;
    salary?: number;
    currency?: string;
    phone?: string;
    email?: string;
    role?: string;
  }>,
  existingUsers: SystemUser[],
  startEmpNumber: number,
): BatchEmployeeDraftRow[] {
  const takenUsernames = new Set(
    existingUsers.map((u) => String(u.username || "").trim().toLowerCase()).filter(Boolean),
  );

  return parsed
    .filter((r) => String(r.name || "").trim().length > 0)
    .map((row, idx) => {
      const code = String(startEmpNumber + idx);
      const role = normalizeStaffRole(row.role, row.job_title);
      const username = generateUniqueBatchUsername("", row.name, code, takenUsernames);
      const currency: "EGP" | "USD" =
        String(row.currency || "").toUpperCase() === "USD" ? "USD" : "EGP";
      const email =
        String(row.email || "").trim().toLowerCase() || `${username}@restocash.com`;

      return {
        tempId: `batch-emp-${idx}-${Date.now()}`,
        name: String(row.name || "").trim(),
        job_title: String(row.job_title || "موظف").trim(),
        department: String(row.department || inferDepartmentFromRole(role)).trim(),
        salary: Math.max(0, Number(row.salary) || 0),
        currency,
        phone: String(row.phone || `0100000${String(1000 + idx).slice(-4)}`).trim(),
        email,
        role,
        createUser: true,
        username,
      };
    });
}

function normalizeStaffRole(role?: string, jobTitle?: string): string {
  const allowed = new Set([
    "cashier",
    "captain",
    "kitchen",
    "delivery",
    "accountant",
    "inventory",
    "hr",
    "manager",
    "admin",
  ]);
  const r = String(role || "").trim().toLowerCase();
  if (allowed.has(r)) return r;

  const jt = String(jobTitle || "").toLowerCase();
  if (/شيف|مطبخ|طباخ|فرن|kitchen|chef|cook/.test(jt)) return "kitchen";
  if (/كابتن|ويتر|مقدم|صالة|captain|waiter/.test(jt)) return "captain";
  if (/دليفري|توصيل|طيار|سائق|delivery|driver/.test(jt)) return "delivery";
  if (/محاسب|مالي|accountant/.test(jt)) return "accountant";
  if (/مخزن|مستودع|جرد|inventory|store/.test(jt)) return "inventory";
  if (/موارد|اتش ار|hr/.test(jt)) return "hr";
  if (/مدير|مشرف|manager|admin/.test(jt)) return "manager";
  return "cashier";
}

function inferDepartmentFromRole(role: string): string {
  if (role === "kitchen") return "المطبخ";
  if (role === "captain" || role === "delivery" || role === "cashier") return "الصالة والتوصيل";
  return "الإدارة";
}
