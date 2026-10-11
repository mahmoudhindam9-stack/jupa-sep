const fs = require("fs");
let content = fs.readFileSync("src/components/mall/ParkCashierTreasuryModal.tsx", "utf8");

const oldHtmlStart = `        <style>
          @page { size: 80mm auto; margin: 0; }
          body { 
            font-family: 'Tajawal', sans-serif, system-ui; 
            width: 76mm; 
            margin: 0 auto; 
            padding: 10px; 
            font-size: 11px; 
            color: #000;
          }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; text-align: right; font-size: 10px; }
          th, td { border-bottom: 1px dashed #ccc; padding: 4px 2px; }
          th { font-weight: bold; border-bottom: 2px solid #000; }
          .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
          .header h2 { font-size: 14px; margin: 0 0 5px 0; }
          .header p { font-size: 10px; margin: 0; }
          .summary { display: flex; flex-direction: column; gap: 4px; margin-bottom: 15px; font-weight: bold; font-size: 12px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
          .divider { border-top: 1px dashed #000; margin: 10px 0; }
        </style>`;

const newHtmlStart = `        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { font-family: 'Tajawal', sans-serif, system-ui; padding: 20px; font-size: 12px; color: #000; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; text-align: right; }
          th, td { border: 1px solid #ccc; padding: 8px; }
          th { background: #f3f4f6; font-weight: bold; }
          .header { text-align: center; margin-bottom: 20px; }
          .header h2 { font-size: 18px; margin: 0 0 5px 0; }
          .summary { display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold; font-size: 14px; }
        </style>`;

if (content.includes(oldHtmlStart.trim())) {
  content = content.replace(oldHtmlStart.trim(), newHtmlStart.trim());
  fs.writeFileSync("src/components/mall/ParkCashierTreasuryModal.tsx", content);
  console.log("Success treasury reverted to A4");
} else {
  console.log("Not found treasury style!");
}
