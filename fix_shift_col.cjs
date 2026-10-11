const fs = require("fs");
let content = fs.readFileSync("src/components/mall/ParkShiftClosingReportModal.tsx", "utf8");

// For HTML Print View
content = content
  .replace(/<th style="width: 10%;">الرقم الفعلي<\/th>/, '<th style="width: 7%;">الرقم الفعلي</th>')
  .replace(
    /<th style="width: 10%;">الرقم الآخر \(قابل للتعديل\)<\/th>/,
    '<th style="width: 7%;">الرقم الآخر</th>',
  )
  .replace(
    /<th style="width: 11%;">التاريخ والوقت<\/th>/,
    '<th style="width: 8%;">التاريخ والوقت</th>',
  )
  .replace(/<th style="width: 10%;">اسم الكاشير<\/th>/, '<th style="width: 7%;">اسم الكاشير</th>')
  .replace(/<th style="width: 9%;">المعامل<\/th>/, '<th style="width: 5%;">المعامل</th>')
  .replace(/<th style="width: 8%;">نوع الحركة<\/th>/, '<th style="width: 5%;">نوع الحركة</th>')
  .replace(/<th>الأصناف والتذاكر<\/th>/, '<th style="width: 25%;">الأصناف والتذاكر</th>')
  .replace(/<th>العميل<\/th>/, '<th style="width: 5%;">العميل</th>')
  .replace(
    /<th style="width: 12%; text-align: left;">المبلغ<\/th>/,
    '<th style="width: 9%; text-align: left;">المبلغ</th>',
  )
  .replace(/<th style="width: 10%;">رقم القيد<\/th>/, '<th style="width: 6%;">رقم القيد</th>');

// For React View
content = content
  .replace(
    /<th className="p-2.5">الأصناف والتذاكر<\/th>/,
    '<th className="p-2.5 w-[25%]">الأصناف والتذاكر</th>',
  )
  .replace(
    /<th className="p-2.5">الرقم الفعلي<\/th>/,
    '<th className="p-2.5 w-[7%]">الرقم الفعلي</th>',
  )
  .replace(
    /<th className="p-2.5">الرقم الآخر \(تعديل\)<\/th>/,
    '<th className="p-2.5 w-[7%]">الرقم الآخر (تعديل)</th>',
  )
  .replace(
    /<th className="p-2.5 text-left">المبلغ<\/th>/,
    '<th className="p-2.5 text-left w-[9%]">المبلغ</th>',
  );

fs.writeFileSync("src/components/mall/ParkShiftClosingReportModal.tsx", content);
console.log("Success columns adjusted");
