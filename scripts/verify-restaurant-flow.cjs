const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) throw new Error(`Missing required file: ${relativePath}`);
  return fs.readFileSync(file, "utf8");
}

const menu = read("src/routes/menu.tsx");
const captain = read("src/routes/captain.tsx");
const cashier = read("src/routes/cashier-treasury.tsx");
const oven = read("src/routes/oven.tsx");
const pos = read("src/routes/pos.tsx");

const checks = [
  [
    "customer orders persist before Captain broadcast",
    (menu.includes('from("orders").upsert') || menu.includes('from("orders").insert')) &&
      (menu.includes('status: "pending_captain"') || menu.includes("restocash_self_orders_bc")),
  ],
  [
    "Captain acceptance persists to Cashier",
    captain.includes('"sent_to_cashier"') && captain.includes('.from("orders")'),
  ],
  [
    "Cashier listens for live order changes",
    cashier.includes("cashier_orders_bridge") &&
      cashier.includes('invalidateQueries({ queryKey: ["cashier-treasury", "orders"] })'),
  ],
  [
    "Oven keeps the durable order bridge",
    oven.includes("oven_orders_channel") && oven.includes('from("orders")'),
  ],
  ["Oven receives its realtime order event", oven.includes("NEW_OVEN_ORDER")],
  [
    "Receipt keeps computed subtotal/tax/total",
    pos.includes("const displaySubtotal") &&
      pos.includes("const displayTax") &&
      pos.includes("const displayTotal"),
  ],
  [
    "Receipt keeps currency and tax rate",
    pos.includes("currency,") &&
      pos.includes("taxRate: invoice.tax_rate ?? receiptSettings.defaultTaxRate"),
  ],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);
if (failed.length) process.exit(1);
console.log("All restaurant cross-page flow invariants passed.");
