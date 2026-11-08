// @ts-nocheck
import JSZip from "jszip";
import { erpStore } from "@/shared/services/erpStore";
import { tableOrdersStore } from "@/shared/services/tableOrdersStore";
import { supabase } from "@/integrations/supabase/client";

// Helper to convert array of objects to UTF-8 BOM CSV for MS Access / Excel
export function objectsToCsv<T extends Record<string, any>>(data: T[], headers?: string[]): string {
  if (!data || data.length === 0) {
    if (headers && headers.length > 0) {
      return "\uFEFF" + headers.join(",") + "\n";
    }
    return "\uFEFF";
  }

  const keys = headers || Array.from(new Set(data.flatMap((obj) => Object.keys(obj))));
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(keys.map((k) => `"${String(k).replace(/"/g, '""')}"`).join(","));

  // Add data rows
  for (const row of data) {
    const values = keys.map((k) => {
      let val = row[k];
      if (val === null || val === undefined) {
        val = "";
      } else if (typeof val === "object") {
        val = JSON.stringify(val);
      } else {
        val = String(val);
      }
      return `"${val.replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }

  // Prepend UTF-8 BOM for Microsoft Access / Excel Arabic compatibility
  return "\uFEFF" + csvRows.join("\n");
}

// Simple robust CSV parser handling quotes and commas
export function csvToObjects(csvString: string): Record<string, string>[] {
  // Remove BOM if present
  const cleanCsv = csvString.replace(/^\uFEFF/, "").trim();
  if (!cleanCsv) return [];

  const lines: string[] = [];
  let currentLine = "";
  let inQuotes = false;

  for (let i = 0; i < cleanCsv.length; i++) {
    const char = cleanCsv[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      currentLine += char;
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && cleanCsv[i + 1] === "\n") {
        i++; // skip \n
      }
      if (currentLine.trim()) {
        lines.push(currentLine);
      }
      currentLine = "";
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine);
  }

  if (lines.length < 1) return [];

  const parseLine = (line: string): string[] => {
    const values: string[] = [];
    let cur = "";
    let inside = false;

    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inside && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inside = !inside;
        }
      } else if (c === "," && !inside) {
        values.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
    values.push(cur);
    return values;
  };

  const headers = parseLine(lines[0]).map((h) => h.replace(/^"|"$/g, "").trim());
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawValues = parseLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((header, idx) => {
      let val = rawValues[idx] || "";
      val = val.replace(/^"|"$/g, "").trim();
      obj[header] = val;
    });
    results.push(obj);
  }

  return results;
}

// Generate MS Access SQL Schema definition
export function generateAccessSqlSchema(): string {
  return `-- ==========================================
-- MS ACCESS COMPATIBLE DATABASE SCHEMA (Restocash Package)
-- RESTOCASH ERP SYSTEM DATA TABLES
-- ==========================================

CREATE TABLE tblAccounts (
  [id] TEXT(100) PRIMARY KEY,
  [code] TEXT(50),
  [name_ar] TEXT(255),
  [name_en] TEXT(255),
  [type] TEXT(50),
  [category] TEXT(50),
  [balance] DOUBLE,
  [parent_id] TEXT(100)
);

CREATE TABLE tblInventory (
  [id] TEXT(100) PRIMARY KEY,
  [item_code] TEXT(50),
  [barcode] TEXT(100),
  [name_ar] TEXT(255),
  [name_en] TEXT(255),
  [category] TEXT(100),
  [unit] TEXT(50),
  [cost] DOUBLE,
  [quantity] DOUBLE,
  [min_stock] DOUBLE
);

CREATE TABLE tblMenu (
  [id] TEXT(100) PRIMARY KEY,
  [name_ar] TEXT(255),
  [name_en] TEXT(255),
  [price] DOUBLE,
  [category_id] TEXT(100),
  [available] YESNO,
  [kitchen_station] TEXT(100)
);

CREATE TABLE tblOrders (
  [id] TEXT(100) PRIMARY KEY,
  [order_type] TEXT(50),
  [table_number] INT,
  [subtotal] DOUBLE,
  [tax] DOUBLE,
  [total] DOUBLE,
  [status] TEXT(50),
  [created_at] DATETIME
);

CREATE TABLE tblEmployees (
  [id] TEXT(100) PRIMARY KEY,
  [name_ar] TEXT(255),
  [role] TEXT(100),
  [salary] DOUBLE,
  [phone] TEXT(50),
  [status] TEXT(50)
);

CREATE TABLE tblTreasuries (
  [id] TEXT(100) PRIMARY KEY,
  [name_ar] TEXT(255),
  [type] TEXT(50),
  [currency] TEXT(20),
  [balance] DOUBLE,
  [branch_id] TEXT(100)
);

-- Note: Import corresponding CSV files (Accounts.csv, Inventory.csv, Menu.csv, Orders.csv, Employees.csv, Treasuries.csv) into MS Access using External Data -> Text File -> Import into Table.
`;
}

/**
 * Downloads a single table as UTF-8 BOM CSV formatted for MS Access
 */
export function downloadAccessSingleTableCsv(tableName: string): void {
  const state = erpStore.getState();
  let data: any[] = [];
  const filename = `${tableName}.csv`;

  if (tableName === "Accounts") data = state.accounts || [];
  else if (tableName === "Inventory") data = state.inventoryItems || [];
  else if (tableName === "Menu") data = state.menuItems || [];
  else if (tableName === "Employees") data = state.employees || [];
  else if (tableName === "Treasuries") data = state.treasuryAccounts || [];
  else if (tableName === "Suppliers") data = state.suppliers || [];
  else if (tableName === "JournalEntries") data = state.journalEntries || [];
  else if (tableName === "Branches") data = state.branches || [];
  else if (tableName === "Orders") data = tableOrdersStore.getOrders() || [];

  const csvContent = objectsToCsv(data);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads the SQL Schema file for MS Access
 */
export function downloadAccessSqlSchemaFile(): void {
  const schemaText = generateAccessSqlSchema();
  const blob = new Blob([schemaText], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Restocash_Access_Schema.sql";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads the complete Access database package as a single ZIP file named "Restocash.zip"
 */
export async function downloadAccessPackageZip(): Promise<void> {
  const zip = new JSZip();

  // Fetch current store state
  const state = erpStore.getState();

  // Also fetch Supabase orders if available
  let supabaseOrders: any[] = [];
  try {
    const { data } = await supabase.from("orders").select("*").limit(1000);
    if (data) supabaseOrders = data;
  } catch (err) {
    console.warn("Could not fetch Supabase orders for export", err);
  }

  // 1. Accounts & Ledger
  const accountsData = state.accounts || [];
  const journalEntries = state.journalEntries || [];
  zip.file("Accounts.csv", objectsToCsv(accountsData));
  zip.file("JournalEntries.csv", objectsToCsv(journalEntries));

  // 2. Inventory & Suppliers
  const inventoryItems = state.inventoryItems || [];
  const suppliers = state.suppliers || [];
  const inventoryDocs = state.inventoryDocuments || [];
  zip.file("Inventory.csv", objectsToCsv(inventoryItems));
  zip.file("Suppliers.csv", objectsToCsv(suppliers));
  zip.file("InventoryDocuments.csv", objectsToCsv(inventoryDocs));

  // 3. Menu & Products
  const menuItems = state.menuItems || [];
  zip.file("Menu.csv", objectsToCsv(menuItems));

  // 4. Orders & POS Transactions
  const storeOrders = tableOrdersStore.getOrders() || [];
  const combinedOrders = [...storeOrders, ...supabaseOrders];
  zip.file("Orders.csv", objectsToCsv(combinedOrders));

  // 5. Employees & HR
  const employees = state.employees || [];
  zip.file("Employees.csv", objectsToCsv(employees));

  // 6. Treasuries & Banking
  const treasuries = state.treasuryAccounts || [];
  zip.file("Treasuries.csv", objectsToCsv(treasuries));

  // 7. System Settings & Branches
  const branches = state.branches || [];
  zip.file("Branches.csv", objectsToCsv(branches));
  zip.file("AppSettings.csv", objectsToCsv([state.inventorySettings || {}]));

  // 8. MS Access SQL Schema & Readme
  zip.file("Restocash_Access_Schema.sql", generateAccessSqlSchema());
  zip.file(
    "README_Restocash_Access_Import.txt",
    `حزمة بيانات أكسس الشاملة - Restocash Access Database Package
======================================================
تم استخراج هذه الحزمة بنجاح من نظام RestoCash ERP.

الملفات المحتواة:
- Accounts.csv: دليل الحسابات
- JournalEntries.csv: قيود اليومية
- Inventory.csv: اصناف المخزون
- Suppliers.csv: الموردين
- Menu.csv: قائمة الطعام والوجبات
- Orders.csv: المبيعات والطلبات
- Employees.csv: الموظفين وشؤون العاملين
- Treasuries.csv: الخزائن والبنوك
- Branches.csv: الفروع
- Restocash_Access_Schema.sql: مخطط جداول MS Access

طريقة الاستيراد في MS Access:
1. افتح برنامج Microsoft Access.
2. انشئ قاعدة بيانات جديدة باسم Restocash.accdb
3. استخدم تبويب (External Data -> Text File) وقم باستيراد كل ملف CSV كجدول منفصل.
`,
  );

  // Generate zip file
  const zipBlob = await zip.generateAsync({ type: "blob" });

  // Trigger download as Restocash.zip
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Restocash.zip";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Uploads and processes an Access package (supports ZIP files containing CSVs and bundled CSV files)
 */
export async function importAccessPackageFile(
  file: File,
): Promise<{ success: boolean; importedTables: string[]; message: string }> {
  try {
    const fileName = file.name.toLowerCase();
    const importedTables: string[] = [];
    const stateUpdates: Partial<ReturnType<typeof erpStore.getState>> = {};

    if (fileName.endsWith(".zip")) {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);

      for (const relativePath of Object.keys(zipContent.files)) {
        const zipEntry = zipContent.files[relativePath];
        if (zipEntry.dir) continue;

        const entryName = relativePath.split("/").pop() || "";
        const entryLower = entryName.toLowerCase();

        if (entryLower.endsWith(".csv")) {
          const csvText = await zipEntry.async("string");
          const parsedRows = csvToObjects(csvText);

          if (parsedRows.length >= 0) {
            if (entryLower.includes("account")) {
              stateUpdates.accounts = parsedRows as any;
              importedTables.push(`Accounts (${parsedRows.length})`);
            } else if (entryLower.includes("inventory")) {
              stateUpdates.inventoryItems = parsedRows as any;
              importedTables.push(`Inventory (${parsedRows.length})`);
            } else if (entryLower.includes("supplier")) {
              stateUpdates.suppliers = parsedRows as any;
              importedTables.push(`Suppliers (${parsedRows.length})`);
            } else if (entryLower.includes("menu")) {
              stateUpdates.menuItems = parsedRows as any;
              importedTables.push(`Menu (${parsedRows.length})`);
            } else if (entryLower.includes("employee")) {
              stateUpdates.employees = parsedRows as any;
              importedTables.push(`Employees (${parsedRows.length})`);
            } else if (entryLower.includes("treasur")) {
              stateUpdates.treasuryAccounts = parsedRows as any;
              importedTables.push(`Treasuries (${parsedRows.length})`);
            } else if (entryLower.includes("branch")) {
              stateUpdates.branches = parsedRows as any;
              importedTables.push(`Branches (${parsedRows.length})`);
            }
          }
        }
      }
    } else if (fileName.endsWith(".csv")) {
      const csvText = await file.text();
      const parsedRows = csvToObjects(csvText);

      if (fileName.includes("account")) {
        stateUpdates.accounts = parsedRows as any;
        importedTables.push(`Accounts (${parsedRows.length})`);
      } else if (fileName.includes("inventory")) {
        stateUpdates.inventoryItems = parsedRows as any;
        importedTables.push(`Inventory (${parsedRows.length})`);
      } else if (fileName.includes("menu")) {
        stateUpdates.menuItems = parsedRows as any;
        importedTables.push(`Menu (${parsedRows.length})`);
      } else if (fileName.includes("employee")) {
        stateUpdates.employees = parsedRows as any;
        importedTables.push(`Employees (${parsedRows.length})`);
      } else {
        importedTables.push(`CSV Data (${parsedRows.length})`);
      }
    } else {
      return {
        success: false,
        importedTables: [],
        message: "الملف المرفوع ليس ملف ZIP أو CSV صالح",
      };
    }

    if (Object.keys(stateUpdates).length > 0) {
      // Merge into erpStore
      const currentState = erpStore.getState();
      const newState = { ...currentState, ...stateUpdates };
      localStorage.setItem("erp_store_state", JSON.stringify(newState));

      // Also persist to Supabase if app_settings available
      try {
        await supabase.from("app_settings" as any).upsert({ id: "erp_state", data: newState });
      } catch (err) {
        console.warn("Could not sync imported state to Supabase:", err);
      }
    }

    return {
      success: true,
      importedTables,
      message:
        importedTables.length > 0
          ? `تم رفع واستيراد حزمة أكسس بنجاح: ${importedTables.join("، ")}`
          : "تمت معالجة الحزمة ولكن لم يتم العثور على جداول مطابقة",
    };
  } catch (err: any) {
    return {
      success: false,
      importedTables: [],
      message: err.message || "حدث خطأ أثناء معالجة حزمة أكسس",
    };
  }
}
