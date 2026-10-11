const fs = require("fs");
let content = fs.readFileSync("src/components/mall/ParkTicketsPOS.tsx", "utf8");

const replacement1 = `    if (printerService.isPrinterConnected()) {
      toast.success("تم إرسال إيصال التذكرة مباشرة إلى الطابعة الحرارية المتصلة 🖨️");
      printerService.printReceipt(receiptData);
    } else {
      toast.success("جاري إرسال أمر الطباعة وفتح نافذة الطباعة 🖨️");
      printerService.printHtmlWindow(receiptData);
    }
    onClose();`;

const newReplacement1 = `    if (printerService.isPrinterConnected()) {
      toast.success("تم إرسال إيصال التذكرة مباشرة إلى الطابعة الحرارية المتصلة 🖨️");
      printerService.printReceipt(receiptData);
    } else {
      toast.success("جاري إرسال أمر الطباعة 🖨️");
      printerService.printHtmlWindow(receiptData);
    }
    onClose();`;

content = content.replace(replacement1, newReplacement1);

fs.writeFileSync("src/components/mall/ParkTicketsPOS.tsx", content);
console.log("Success fixed print handlers in POS");
