const fs = require("fs");
let content = fs.readFileSync("src/components/mall/ParkTicketsPOS.tsx", "utf8");

// Replace handleProcessSale from "toast.success(`تم إصدار التذاكر بنجاح! رقم الفاتورة: ${res.transaction.tx_number}`);"
// to "} catch (err: any) {"

content = content.replace(
  /toast\.success\(\`تم إصدار التذاكر بنجاح! رقم الفاتورة: \$\{res\.transaction\.tx_number\}\`\);[\s\S]*?\} catch \(err: any\) \{/g,
  `toast.success(\`تم إصدار التذاكر بنجاح! رقم الفاتورة: \$\{res.transaction.tx_number\}\`);

      // Reset cart immediately as requested
      setCartItems([]);
      setReferenceNumber("");
      setOverallNotes("");
    } catch (err: any) {`,
);

fs.writeFileSync("src/components/mall/ParkTicketsPOS.tsx", content);
