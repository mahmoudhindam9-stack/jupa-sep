const fs = require("fs");
let content = fs.readFileSync("src/components/mall/ParkShiftClosingReportModal.tsx", "utf8");

// React View
content = content.replace(
  /<th className="p-2">الشرح \/ البيان<\/th>/g,
  '<th className="p-2 w-[55%]">الشرح / البيان</th>',
);
content = content.replace(
  /<th className="p-2">رقم الحساب<\/th>/g,
  '<th className="p-2 w-[15%]">رقم الحساب</th>',
);
content = content.replace(
  /<th className="p-2 text-left">مدين<\/th>/g,
  '<th className="p-2 text-left w-[10%]">مدين</th>',
);
content = content.replace(
  /<th className="p-2 text-left">دائن<\/th>/g,
  '<th className="p-2 text-left w-[10%]">دائن</th>',
);
content = content.replace(
  /<th className="p-2">العملة والمعامل<\/th>/g,
  '<th className="p-2 w-[10%]">العملة والمعامل</th>',
);

// Print View
content = content.replace(
  /<th style="padding: 4px 6px; border: 1px solid #e2e8f0; width: 12%;">رقم الحساب<\/th>/g,
  '<th style="padding: 4px 6px; border: 1px solid #e2e8f0; width: 15%;">رقم الحساب</th>',
);
content = content.replace(
  /<th style="padding: 4px 6px; border: 1px solid #e2e8f0;">اسم الحساب \/ الشرح<\/th>/g,
  '<th style="padding: 4px 6px; border: 1px solid #e2e8f0; width: 50%;">اسم الحساب / الشرح</th>',
);

fs.writeFileSync("src/components/mall/ParkShiftClosingReportModal.tsx", content);
