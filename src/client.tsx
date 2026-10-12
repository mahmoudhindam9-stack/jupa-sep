import { printCurrentPage } from "./shared/utils/printPage";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

const CHUNK_RECOVERY_KEY = "restocash:chunk-recovery-attempted";

if (typeof window !== "undefined") {
  // If this entry loaded successfully, a previous recovery attempt is no longer needed.
  try {
    window.sessionStorage.removeItem(CHUNK_RECOVERY_KEY);
  } catch {
    // Storage can be unavailable in restricted preview iframes.
  }

  // The recovery listener runs from server-rendered HTML in __root.tsx,
  // before this module is imported, so it can handle failure to load this entry itself.
}

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
