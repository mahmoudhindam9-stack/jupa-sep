import { printCurrentPage } from "./shared/utils/printPage";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});

if (typeof window !== "undefined") {
  const originalPrint = window.print;
  window.print = function () {
    try {
      // Try to execute native print command (might fail silently in sandboxed iframe)
      const res = document.execCommand("print", false, "");
      if (res) return;
    } catch (e) {
      void e;
    }

    console.log("Using robust print fallback...");
    printCurrentPage();
  };
}
