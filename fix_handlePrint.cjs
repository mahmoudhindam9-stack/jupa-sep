const fs = require("fs");
let content = fs.readFileSync("src/components/mall/ParkTicketsPOS.tsx", "utf8");

content = content.replace(
  /      printerService\.printHtmlWindow\(receiptData\);\n    \}\n  \};/g,
  `      printerService.printHtmlWindow(receiptData);
    }
    onClose();
  };`,
);

fs.writeFileSync("src/components/mall/ParkTicketsPOS.tsx", content);
