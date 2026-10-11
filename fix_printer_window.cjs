const fs = require("fs");
let content = fs.readFileSync("src/shared/services/printerService.ts", "utf8");

// I will make sure the printer popup forces an 80mm window in a nice way, or fallback nicely.
// Earlier I created a hidden thermal iframe popup.

const newIframeLogic = `    const printWindow = window.open("", "_blank", "width=320,height=600,left=100,top=100");
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
        iframe.style.width = "80mm";
        iframe.style.height = "100vh";
        iframe.style.zIndex = "-9999";
        iframe.style.opacity = "0";
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
        }, 500);
      }
    }
  }`;

content = content.replace(
  /    const printWindow = window\.open\("", "_blank", "width=400,height=600"\);[\s\S]*\}\n  \}/g,
  newIframeLogic,
);

fs.writeFileSync("src/shared/services/printerService.ts", content);
console.log("Success thermal printer pop-up adjusted");
