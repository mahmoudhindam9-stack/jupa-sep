const fs = require("fs");

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing required file: ${path}`);
  return fs.readFileSync(path, "utf8");
}

const ledger = read("src/routes/admin/ledger.tsx");
const dashboard = read("src/routes/admin/index.tsx");
const store = read("src/shared/services/erpStore.ts");
const grouping = read("src/shared/utils/oracleJournalGrouping.ts");

const checks = [
  [
    "save button is gated by unsaved journals",
    ledger.includes("disabled={isSavingToDb || !hasUnsavedChanges}"),
  ],
  [
    "Oracle ordered grouping is used by ledger import",
    ledger.includes("groupOracleRowsIntoJournalEntriesOrdered"),
  ],
  [
    "Oracle grouping identity includes year/month/journal sequence",
    grouping.includes('const key = `${year}|${String(month).padStart(2, "0")}|${sequence}`'),
  ],
  [
    "Oracle grouping implementation protects Map lookups",
    grouping.includes("const existing = groups.get(key);") &&
      grouping.includes("if (existing) {") &&
      (grouping.includes("groups.set(key, { year, month, sequence, date: row.date, rows: [row] });") ||
        grouping.includes("groups.set(key, { year, month, sequence, date: entryDate, rows: [row] });")),
  ],
  ["created accounts are exposed to the import report", ledger.includes("newlyCreatedAccounts")],
  [
    "dashboard treasury cards can read live GL balances",
    dashboard.includes("liveAccountBalance") && dashboard.includes("displayBalance"),
  ],
  [
    "system-bound balances use the journal balance map",
    store.includes("acc.balance = balanceMap[acc.code]"),
  ],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
if (failed.length)
  throw new Error(`${failed.length} financial synchronization invariant(s) failed.`);
console.log("All financial synchronization invariants passed.");
