const fs = require("fs");
let content = fs.readFileSync("src/shared/services/printerService.ts", "utf8");

// Replace the call to printRawHtml with an actual thermal iframe popup specifically built for 80mm
const newPrintCode = `
    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        setTimeout(() => printWindow.close(), 500);
      }, 250);
    } else {
      // Fallback for popups blocked: inject a specialized thermal iframe
      let iframe = document.getElementById("thermal-print-iframe") as HTMLIFrameElement;
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = "thermal-print-iframe";
        iframe.style.position = "fixed";
        iframe.style.right = "0";
        iframe.style.bottom = "0";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "0";
        document.body.appendChild(iframe);
      }
      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        }, 300);
      }
    }
  }
`;

content = content.replace(/    printRawHtml\(html\);\n  \}/, newPrintCode);

fs.writeFileSync("src/shared/services/printerService.ts", content);
console.log("Success thermal specialized print window");
