const fs = require("fs");
let content = fs.readFileSync("src/shared/utils/printAccountingDocument.ts", "utf8");

content = content.replace(/iframe\.style\.width = "80mm";/g, 'iframe.style.width = "0";');
content = content.replace(/iframe\.style\.height = "100vh";/g, 'iframe.style.height = "0";');
content = content.replace(/iframe\.style\.right = "-1000px";/g, 'iframe.style.right = "0";');

fs.writeFileSync("src/shared/utils/printAccountingDocument.ts", content);
console.log("Success iframe reverted");
